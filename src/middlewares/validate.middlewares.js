import ApiError from "../utils/ApiError.js";

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    // ✅ Zod uses `issues`, not `errors`
    const errors = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message
    }));

    next(new ApiError(400, "Validation failed", errors));
  }
};
