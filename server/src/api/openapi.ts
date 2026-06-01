/**
 * G13 — Static OpenAPI 3.0 specification for the Swwarm Public API.
 *
 * Returned at GET /api/v1/openapi.json — no authentication required.
 */

export const OPENAPI_VERSION = "1.0.0";

export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Swwarm Public API",
      version: OPENAPI_VERSION,
      description:
        "REST API for integrating with Swwarm AI agents. " +
        "Authenticate with a Bearer token obtained from your company settings.",
      contact: { email: "api@swwarm.com" },
    },
    servers: [{ url: `${baseUrl}/api/v1`, description: "Production" }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description: "Obtain from POST /companies/{companyId}/public-api/keys",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
          required: ["error"],
        },
        Agent: {
          type: "object",
          properties: {
            id:          { type: "string", format: "uuid" },
            name:        { type: "string" },
            description: { type: "string" },
            icon:        { type: "string" },
            isActive:    { type: "boolean" },
            createdAt:   { type: "string", format: "date-time" },
          },
          required: ["id", "name", "isActive", "createdAt"],
        },
        Task: {
          type: "object",
          properties: {
            id:          { type: "string", format: "uuid" },
            title:       { type: "string" },
            status:      { type: "string", enum: ["open", "in_progress", "blocked", "awaiting_approval", "done", "cancelled"] },
            agentId:     { type: "string", format: "uuid" },
            createdAt:   { type: "string", format: "date-time" },
            updatedAt:   { type: "string", format: "date-time" },
          },
          required: ["id", "title", "status", "createdAt"],
        },
        CreateTaskRequest: {
          type: "object",
          properties: {
            title:       { type: "string", minLength: 1, maxLength: 500 },
            description: { type: "string" },
            agentId:     { type: "string", format: "uuid" },
          },
          required: ["title"],
        },
        Mission: {
          type: "object",
          properties: {
            id:          { type: "string", format: "uuid" },
            title:       { type: "string" },
            status:      { type: "string", enum: ["draft", "active", "blocked", "complete", "archived"] },
            createdAt:   { type: "string", format: "date-time" },
            completedAt: { type: "string", format: "date-time", nullable: true },
          },
          required: ["id", "title", "status", "createdAt"],
        },
        CreateMissionRequest: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 200 },
            brief: { type: "string" },
          },
          required: ["title"],
        },
        WebhookSubscription: {
          type: "object",
          properties: {
            id:        { type: "string", format: "uuid" },
            url:       { type: "string", format: "uri" },
            events:    { type: "array", items: { type: "string" } },
            active:    { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["id", "url", "events", "active", "createdAt"],
        },
        CreateWebhookRequest: {
          type: "object",
          properties: {
            url:    { type: "string", format: "uri" },
            events: {
              type: "array",
              items: {
                type: "string",
                enum: ["task.created","task.completed","task.blocked","task.failed","task.cancelled",
                       "mission.created","mission.completed","mission.archived","agent.status_changed","*"],
              },
              description: "Event types to subscribe to. Use [\"*\"] for all events.",
            },
          },
          required: ["url", "events"],
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      "/agents": {
        get: {
          operationId: "listAgents",
          summary: "List agents",
          description: "Returns all active agents for the authenticated company.",
          tags: ["Agents"],
          responses: {
            "200": {
              description: "Agent list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      agents: { type: "array", items: { $ref: "#/components/schemas/Agent" } },
                    },
                    required: ["agents"],
                  },
                },
              },
            },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/agents/{id}": {
        get: {
          operationId: "getAgent",
          summary: "Get agent",
          tags: ["Agents"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Agent", content: { "application/json": { schema: { $ref: "#/components/schemas/Agent" } } } },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Not found",      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/tasks": {
        get: {
          operationId: "listTasks",
          summary: "List tasks",
          tags: ["Tasks"],
          parameters: [
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "agentId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "limit",  in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "Task list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
                      total: { type: "integer" },
                    },
                    required: ["tasks", "total"],
                  },
                },
              },
            },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          operationId: "createTask",
          summary: "Create task",
          tags: ["Tasks"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTaskRequest" } } },
          },
          responses: {
            "201": { description: "Task created", content: { "application/json": { schema: { $ref: "#/components/schemas/Task" } } } },
            "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Invalid API key",  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Read-only key",    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/tasks/{id}": {
        get: {
          operationId: "getTask",
          summary: "Get task",
          tags: ["Tasks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Task",      content: { "application/json": { schema: { $ref: "#/components/schemas/Task" } } } },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Not found",  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks/subscriptions": {
        get: {
          operationId: "listWebhookSubscriptions",
          summary: "List webhook subscriptions",
          tags: ["Webhooks"],
          responses: {
            "200": {
              description: "Subscription list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      subscriptions: { type: "array", items: { $ref: "#/components/schemas/WebhookSubscription" } },
                    },
                    required: ["subscriptions"],
                  },
                },
              },
            },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          operationId: "createWebhookSubscription",
          summary: "Create webhook subscription",
          tags: ["Webhooks"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWebhookRequest" } } },
          },
          responses: {
            "201": { description: "Subscription created", content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookSubscription" } } } },
            "400": { description: "Validation error",      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Invalid API key",       content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Read-only key",         content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/missions": {
        get: {
          operationId: "listMissions",
          summary: "List missions",
          description: "Returns CEO-level missions for the authenticated company.",
          tags: ["Missions"],
          parameters: [
            { name: "limit",  in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "Mission list",
              content: { "application/json": { schema: { type: "object", properties: { missions: { type: "array", items: { $ref: "#/components/schemas/Mission" } }, limit: { type: "integer" }, offset: { type: "integer" } }, required: ["missions"] } } },
            },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          operationId: "createMission",
          summary: "Create mission",
          description: "Create a new CEO-level mission. The orchestrator decomposes it into tasks.",
          tags: ["Missions"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateMissionRequest" } } },
          },
          responses: {
            "201": { description: "Mission created", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, mission: { $ref: "#/components/schemas/Mission" } } } } } },
            "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Invalid API key",  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Read-only key",    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/missions/{id}": {
        get: {
          operationId: "getMission",
          summary: "Get mission",
          tags: ["Missions"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Mission", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, mission: { $ref: "#/components/schemas/Mission" } } } } } },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Not found",       content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks/subscriptions/{id}": {
        delete: {
          operationId: "deleteWebhookSubscription",
          summary: "Delete webhook subscription",
          tags: ["Webhooks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Deleted", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } },
            "401": { description: "Invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Read-only key",   content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Not found",        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
  } as const;
}
