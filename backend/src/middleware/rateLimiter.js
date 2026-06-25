const rateLimit = require("express-rate-limit");

const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many review requests. Please try again later."
    }
});

module.exports = reviewLimiter;