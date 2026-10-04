import express, { Request, Response } from 'express';
import identityRoutes from './modules/identity/presentation/routes/identity.routes.js';
import cookieParser from 'cookie-parser';

const app = express();

app.disable('x-powered-by');

app.use(express.json());
app.use(cookieParser());

app.use('/auth', identityRoutes);

app.get('/', (req: Request, res: Response) => {
  console.log(req);
  res.json({
    message: 'Hello from Express API',
    status: 'success',
  });
});

export default app;
