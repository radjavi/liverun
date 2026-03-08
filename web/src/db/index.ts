import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const db = drizzle(process.env.DATABASE_URL!, { schema: { ...schema, ...authSchema } });

export default db;
