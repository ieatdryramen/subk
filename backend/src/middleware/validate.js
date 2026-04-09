const { body, param, query, validationResult } = require('express-validator');

// Centralized validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

// ── Common validation chains ──

const validateEmail = body('email')
  .isEmail().withMessage('Valid email required')
  .normalizeEmail()
  .isLength({ max: 255 }).withMessage('Email too long');

const validatePassword = body('password')
  .isLength({ min: 12, max: 128 }).withMessage('Password must be 12-128 characters')
  .matches(/[A-Z]/).withMessage('Password needs an uppercase letter')
  .matches(/[a-z]/).withMessage('Password needs a lowercase letter')
  .matches(/[0-9]/).withMessage('Password needs a number')
  .matches(/[^A-Za-z0-9]/).withMessage('Password needs a special character');

const validateFullName = body('full_name')
  .optional()
  .trim()
  .isLength({ max: 255 }).withMessage('Name too long')
  .escape();

const validateId = (field = 'id') => param(field)
  .isInt({ min: 1 }).withMessage(`Invalid ${field}`);

const validatePagination = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
];

const validateSearch = query('search')
  .optional()
  .trim()
  .isLength({ max: 200 }).withMessage('Search query too long')
  .escape();

// ── Route-specific validators ──

const validateRegister = [validateEmail, validatePassword, validateFullName, handleValidationErrors];

const validateLogin = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
  handleValidationErrors,
];

const validateListCreate = [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('List name required (max 255 chars)'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  handleValidationErrors,
];

const validateLeadCreate = [
  body('full_name').trim().isLength({ min: 1, max: 255 }).withMessage('Name required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email').normalizeEmail(),
  body('company').optional().trim().isLength({ max: 255 }).withMessage('Company name too long'),
  body('title').optional().trim().isLength({ max: 255 }).withMessage('Title too long'),
  body('phone').optional().trim().isLength({ max: 50 }).withMessage('Phone too long'),
  handleValidationErrors,
];

const validateNote = [
  body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('Note content required (max 10000 chars)'),
  handleValidationErrors,
];

const validateProposal = [
  body('title').trim().isLength({ min: 1, max: 500 }).withMessage('Proposal title required'),
  body('status').optional().isIn(['drafting', 'review', 'submitted', 'won', 'lost']).withMessage('Invalid status'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateEmail,
  validatePassword,
  validateFullName,
  validateId,
  validatePagination,
  validateSearch,
  validateRegister,
  validateLogin,
  validateListCreate,
  validateLeadCreate,
  validateNote,
  validateProposal,
};
