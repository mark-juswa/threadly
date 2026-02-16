const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // 1. Check for Mongoose "CastError" (Invalid ID format, e.g., "123" instead of ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found (Invalid ID)';
  }

  // 2. Check for Mongoose "ValidationError" (e.g., missing required fields)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // Extract purely the error messages
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export { errorHandler };