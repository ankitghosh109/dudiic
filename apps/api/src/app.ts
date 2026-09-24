import express from 'express';
import identityRoutes from './modules/identity/presentation/routes/identity.routes.js';

const app = express();

app.disable('x-powered-by');

app.use(express.json());

app.use('/auth', identityRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Express API',
    status: 'success',
  });
});

export default app;
