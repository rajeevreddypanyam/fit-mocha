import { Hono } from "hono";
import { cors } from "hono/cors";
import exercises from "./routes/exercises";
import workouts from "./routes/workouts";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use('*', cors());

// API Routes
app.route('/api/exercises', exercises);
app.route('/api/workouts', workouts);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;
