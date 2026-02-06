// middleware/clerkAuth.js
const { verifySessionToken } = require('@clerk/clerk-sdk-node');

module.exports = function clerkAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('token',token);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  verifySessionToken(token)
    .then((session) => {
      req.auth = { userId: session.sub };
      next();
    })
    .catch((err) => {
      console.error('Clerk auth failed:', err);
      res.status(401).json({ message: 'Unauthorized' });
    });
};