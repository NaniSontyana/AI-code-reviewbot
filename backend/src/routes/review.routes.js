const express=require("express");
const router=express.Router();
const {handleReview}= require("../controllers/review.controller");

router.post("/", handleReview);

module.exports = router;