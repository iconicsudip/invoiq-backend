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

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3000);
  const apiPrefix = configService.get<string>("API_PREFIX", "api/v1");
  const nodeEnv = configService.get<string>("NODE_ENV", "development");

  // Security
  app.use(helmet.default());
  app.use(compression());
  app.use(cookieParser());

  // CORS
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

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger docs (non-production or when explicitly enabled)
  if (
    nodeEnv !== "production" ||
    configService.get("SWAGGER_ENABLED") === "true"
  ) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Invoiq API")
      .setDescription(
        "Production-grade multi-tenant SaaS billing platform for freelancers and agencies",
      )
      .setVersion("1.0.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
        "JWT-auth",
      )
      .addApiKey(
        { type: "apiKey", in: "header", name: "x-workspace-id" },
        "workspace-id",
      )
      .addTag("Auth", "Authentication & authorization")
      .addTag("Workspaces", "Workspace management")
      .addTag("Team", "Team member management")
      .addTag("Clients", "Client management")
      .addTag("Projects", "Project management")
      .addTag("Invoices", "Invoice management & PDF generation")
      .addTag("Plans", "Billing plan management")
      .addTag("Subscriptions", "Recurring subscription management")
      .addTag("Contracts", "Contract management")
      .addTag("Transactions", "Payment transactions")
      .addTag("Dashboard", "Analytics & dashboard")
      .addTag("Notifications", "Push notifications")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    });

    logger.log(`Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
  }

  await app.listen(port);
  logger.log(`Application running on port ${port} [${nodeEnv}]`);
  logger.log(`API: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
