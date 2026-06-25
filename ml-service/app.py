import os
import tempfile
# Triggered reloader after downgrading httpx package
import traceback
import json
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Gracefully handle optional psycopg2 dependency
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    psycopg2_available = True
except ImportError:
    psycopg2_available = False
    print("WARNING: psycopg2-binary is not installed. Python microservice will run in local Mock Database Mode.")

from config import Config

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Validate config
Config.validate()

# Shared mock database path in the workspace root
MOCK_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mock_db.json")

# Load embedding model on startup
print(f"Loading embedding model '{Config.EMBEDDING_MODEL_NAME}'...")
try:
    embedding_model = SentenceTransformer(Config.EMBEDDING_MODEL_NAME)
    print("Embedding model loaded successfully.")
except Exception as e:
    print(f"ERROR: Failed to load embedding model: {e}")
    embedding_model = None

# Initialize Groq client
groq_client = None
if Config.GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=Config.GROQ_API_KEY)
    except Exception as e:
        print(f"ERROR: Failed to initialize Groq client: {e}")

# Global flag to track if we should force local mock database mode
use_mock_db = not psycopg2_available or not Config.DATABASE_URL

def get_db_connection():
    """Establishes a real database connection if available."""
    if use_mock_db:
        raise ConnectionError("Mock mode is enabled, bypassing real connection.")
    return psycopg2.connect(Config.DATABASE_URL)

# Pure-Python Cosine Similarity Helper
def compute_cosine_similarity(v1, v2):
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_a = sum(a * a for a in v1) ** 0.5
    norm_b = sum(b * b for b in v2) ** 0.5
    if norm_a * norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)

# Local Mock Database Helper Functions (Interacts with shared mock_db.json)
def init_mock_db():
    if not os.path.exists(MOCK_DB_PATH):
        initial_data = {
            "users": [],
            "documents": [],
            "document_chunks": [],
            "chat_messages": []
        }
        with open(MOCK_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(initial_data, f, indent=2)

def read_mock_db():
    init_mock_db()
    try:
        with open(MOCK_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading mock DB: {e}")
        return {"users": [], "documents": [], "document_chunks": [], "chat_messages": []}

def write_mock_db(data):
    try:
        with open(MOCK_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error writing mock DB: {e}")

def mock_insert_chunks(document_id, chunks_to_insert, page_count):
    db = read_mock_db()
    
    # 1. Append new chunks to document_chunks
    for chunk in chunks_to_insert:
        db["document_chunks"].append({
            "document_id": document_id,
            "chunk_text": chunk["chunk_text"],
            "page_number": chunk["page_number"],
            "chunk_index": chunk["chunk_index"],
            "embedding": chunk["embedding"]
        })
        
    # 2. Find and update the document status
    for doc in db["documents"]:
        if doc["id"] == document_id:
            doc["status"] = "ready"
            doc["page_count"] = page_count
            doc["chunk_count"] = len(chunks_to_insert)
            break
            
    write_mock_db(db)

def mock_update_failed(document_id):
    db = read_mock_db()
    for doc in db["documents"]:
        if doc["id"] == document_id:
            doc["status"] = "failed"
            break
    write_mock_db(db)

def mock_query_chunks(document_id, query_embedding, top_k):
    db = read_mock_db()
    
    # 1. Filter chunks belonging to this document
    doc_chunks = [c for c in db["document_chunks"] if c["document_id"] == document_id]
    
    if not doc_chunks:
        return []
        
    # 2. Compute similarity for each chunk in-memory
    scored_chunks = []
    for chunk in doc_chunks:
        similarity = compute_cosine_similarity(query_embedding, chunk["embedding"])
        scored_chunks.append({
            "chunk_text": chunk["chunk_text"],
            "page_number": chunk["page_number"],
            "chunk_index": chunk["chunk_index"],
            "similarity": similarity
        })
        
    # 3. Sort by similarity descending (order by embedding <=> %s ASC)
    scored_chunks.sort(key=lambda x: x["similarity"], reverse=True)
    
    # 4. Return top_k
    return scored_chunks[:top_k]


@app.route("/ml/health", methods=["GET"])
def health_check():
    """Simple health check endpoint."""
    status = {
        "status": "ok",
        "model_loaded": embedding_model is not None,
        "groq_initialized": groq_client is not None,
        "database_mode": "local_mock_json" if use_mock_db else "postgresql_pgvector"
    }
    return jsonify(status), 200

@app.route("/ml/process-document", methods=["POST"])
def process_document():
    """
    Endpoint to parse a PDF, chunk its text page-by-page, generate embeddings,
    and save them into the database (PostgreSQL pgvector or local Mock JSON).
    """
    global use_mock_db
    
    if not embedding_model:
        return jsonify({"success": False, "message": "Embedding model not loaded"}), 500
    
    if "file" not in request.files:
        return jsonify({"success": False, "message": "No file part in the request"}), 400
    
    file = request.files["file"]
    document_id = request.form.get("document_id")
    
    if not document_id:
        return jsonify({"success": False, "message": "document_id is required"}), 400
    
    if file.filename == "":
        return jsonify({"success": False, "message": "No selected file"}), 400

    conn = None
    temp_file_path = None
    
    try:
        # 1. Save uploaded file to a temporary location
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, f"{document_id}.pdf")
        file.save(temp_file_path)
        
        # 2. Open PDF and extract text page-by-page
        print(f"Processing document {document_id}: {file.filename}")
        chunks_to_insert = []
        page_count = 0
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=100,
            length_function=len
        )
        
        with pdfplumber.open(temp_file_path) as pdf:
            page_count = len(pdf.pages)
            print(f"PDF has {page_count} pages.")
            
            chunk_index = 0
            for page_num, page in enumerate(pdf.pages, start=1):
                text = page.extract_text()
                if not text or text.strip() == "":
                    continue
                
                page_chunks = text_splitter.split_text(text)
                
                for chunk_text in page_chunks:
                    if chunk_text.strip() == "":
                        continue
                    
                    chunks_to_insert.append({
                        "document_id": document_id,
                        "chunk_text": chunk_text,
                        "page_number": page_num,
                        "chunk_index": chunk_index
                    })
                    chunk_index += 1
        
        if not chunks_to_insert:
            raise ValueError("No text could be extracted from the PDF document.")
            
        print(f"Generated {len(chunks_to_insert)} chunks. Computing embeddings...")
        
        # 3. Batch generate embeddings for speed
        texts = [c["chunk_text"] for c in chunks_to_insert]
        embeddings = embedding_model.encode(texts, batch_size=32, show_progress_bar=False)
        
        for idx, emb in enumerate(embeddings):
            chunks_to_insert[idx]["embedding"] = emb.tolist()
            
        # 4. Insert chunks and update document status
        if use_mock_db:
            print("Database connection offline. Saving to shared mock_db.json...")
            mock_insert_chunks(document_id, chunks_to_insert, page_count)
        else:
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                
                print("Inserting chunks into PostgreSQL...")
                for chunk in chunks_to_insert:
                    cur.execute(
                        """
                        INSERT INTO document_chunks (document_id, chunk_text, page_number, chunk_index, embedding)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            chunk["document_id"],
                            chunk["chunk_text"],
                            chunk["page_number"],
                            chunk["chunk_index"],
                            chunk["embedding"]
                        )
                    )
                    
                cur.execute(
                    """
                    UPDATE documents
                    SET status = 'ready', page_count = %s, chunk_count = %s
                    WHERE id = %s
                    """,
                    (page_count, len(chunks_to_insert), document_id)
                )
                conn.commit()
                cur.close()
            except Exception as db_err:
                print(f"PostgreSQL operations failed: {db_err}. Switching to Mock DB fallback...")
                use_mock_db = True
                mock_insert_chunks(document_id, chunks_to_insert, page_count)
        
        print(f"Document {document_id} processed successfully!")
        return jsonify({
            "success": True,
            "message": "Document processed and indexed successfully",
            "page_count": page_count,
            "chunk_count": len(chunks_to_insert)
        }), 200

    except Exception as e:
        print(f"ERROR: Failed to process document {document_id}: {e}")
        traceback.print_exc()
        
        # Mark document as failed
        if use_mock_db:
            mock_update_failed(document_id)
        else:
            try:
                if not conn or conn.closed:
                    conn = get_db_connection()
                cur = conn.cursor()
                cur.execute(
                    "UPDATE documents SET status = 'failed' WHERE id = %s",
                    (document_id,)
                )
                conn.commit()
                cur.close()
            except Exception as db_err:
                print(f"Failed to update document status to failed in PostgreSQL: {db_err}. Updating in Mock DB...")
                mock_update_failed(document_id)
            
        return jsonify({
            "success": False,
            "message": f"Processing failed: {str(e)}"
        }), 500
        
    finally:
        if conn:
            conn.close()
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as clean_err:
                print(f"Failed to clean up temp file {temp_file_path}: {clean_err}")

@app.route("/ml/query", methods=["POST"])
def query_document():
    """
    Endpoint to search similar document chunks, build a grounded prompt,
    and generate an answer using the Groq LLM.
    """
    global use_mock_db
    
    if not embedding_model:
        return jsonify({"success": False, "message": "Embedding model not loaded"}), 500
    if not groq_client:
        return jsonify({"success": False, "message": "Groq client not initialized"}), 500
        
    data = request.json or {}
    question = data.get("question")
    document_id = data.get("document_id")
    top_k = int(data.get("top_k", 4))
    
    if not question or not document_id:
        return jsonify({"success": False, "message": "question and document_id are required"}), 400
        
    conn = None
    try:
        # 1. Embed the query
        query_embedding = embedding_model.encode(question).tolist()
        
        # 2. Retrieve top-k chunks
        if use_mock_db:
            print("Database connection offline. Searching chunks in-memory using cosine similarity...")
            retrieved_chunks = mock_query_chunks(document_id, query_embedding, top_k)
        else:
            try:
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                
                cur.execute(
                    """
                    SELECT chunk_text, page_number, chunk_index,
                           (1 - (embedding <=> %s::vector)) AS similarity
                    FROM document_chunks
                    WHERE document_id = %s
                    ORDER BY embedding <=> %s::vector ASC
                    LIMIT %s
                    """,
                    (query_embedding, document_id, query_embedding, top_k)
                )
                retrieved_chunks = cur.fetchall()
                cur.close()
            except Exception as db_err:
                print(f"PostgreSQL query failed: {db_err}. Switching to Mock DB fallback...")
                use_mock_db = True
                retrieved_chunks = mock_query_chunks(document_id, query_embedding, top_k)
        
        if not retrieved_chunks:
            return jsonify({
                "success": True,
                "answer": "I could not find any relevant text in the document to answer your question.",
                "citations": []
            }), 200
            
        # 3. Construct a grounded context
        context_parts = []
        for row in retrieved_chunks:
            context_parts.append(f"[Page {row['page_number']}]\n{row['chunk_text']}")
            
        context_text = "\n\n---\n\n".join(context_parts)
        
        # 4. Formulate LLM Prompt (strict grounding instructions)
        system_prompt = (
            "You are a helpful, professional AI document assistant.\n"
            "Answer the user's question based strictly and ONLY on the provided context below.\n"
            "If the context does not contain enough information to answer, state clearly: "
            "\"I cannot find the answer in the uploaded document.\"\n"
            "Do not make up facts, do not use external knowledge, and do not extrapolate beyond what is explicitly written.\n"
            "Keep your answer clear, direct, and well-structured (use bullet points or lists if appropriate)."
        )
        
        user_prompt = f"""DOCUMENT CONTEXT:
{context_text}
        
USER QUESTION:
{question}
        
Formulate your response now based strictly on the document context:"""

        # 5. Invoke Groq API
        print(f"Invoking Groq API for query on doc {document_id}")
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=800
        )
        
        answer = completion.choices[0].message.content
        
        # 6. Format citations
        citations = []
        for row in retrieved_chunks:
            citations.append({
                "page": row["page_number"],
                "text": row["chunk_text"][:200] + "..." if len(row["chunk_text"]) > 200 else row["chunk_text"],
                "score": round(float(row["similarity"]), 4)
            })
            
        return jsonify({
            "success": True,
            "answer": answer,
            "citations": citations
        }), 200

    except Exception as e:
        print(f"ERROR: Query failed for document {document_id}: {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Query failed: {str(e)}"
        }), 500
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"Starting ML Microservice on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
