const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return value;
};

export const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: required('MONGODB_URI'),
  appSecret: required('META_APP_SECRET'),
  verifyToken: required('WEBHOOK_VERIFY_TOKEN'),
  adminApiKey: required('ADMIN_API_KEY'),
  graphHost: process.env.GRAPH_HOST || 'graph.facebook.com',
  graphVersion: process.env.GRAPH_VERSION || 'v27.0',
};
