export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: result.error.flatten().fieldErrors } });
  req.validated = result.data; next();
};
