import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import cookieParser from "cookie-parser";
import * as helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

let cachedApp: any;

async function bootstrap() {
  if (cachedApp) return cachedApp;

  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>("API_PREFIX", "api/v1");
  const nodeEnv = configService.get<string>("NODE_ENV", "development");

  app.use(helmet.default());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: [
      configService.get<string>("FRONTEND_URL", "http://localhost:3001"),
      /^capacitor:\/\//,
      /^exp:\/\//,
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-workspace-id"],
  });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  if (nodeEnv !== "production" || configService.get("SWAGGER_ENABLED") === "true") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Invoiq API")
      .setDescription("Production-grade multi-tenant SaaS billing platform")
      .setVersion("1.0.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
        "JWT-auth",
      )
      .addApiKey(
        { type: "apiKey", in: "header", name: "x-workspace-id" },
        "workspace-id",
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  await app.init();
  cachedApp = app;
  logger.log("App initialized");
  return cachedApp;
}

// Serverless handler for Vercel
export default async function handler(req: any, res: any) {
  const app = await bootstrap();
  const server = app.getHttpAdapter().getInstance();
  server(req, res);
}

// Local dev: listen on port
if (process.env.NODE_ENV !== "production") {
  bootstrap().then(async (app) => {
    const configService = app.get(ConfigService);
    const port = configService.get("PORT", 3000);
    await app.listen(port);
    console.log(`Running on http://localhost:${port}`);
  });
}
