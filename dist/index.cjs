"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_cors = __toESM(require("@fastify/cors"), 1);
var import_fastify = __toESM(require("fastify"), 1);

// src/lib/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();

// src/index.ts
var fastify = (0, import_fastify.default)({
  logger: true
});
fastify.register(import_cors.default, {
  origin: "*",
  methods: "*"
});
fastify.get("/tasks", async function(_request, reply) {
  const tasks = await prisma.task.findMany();
  return reply.send(tasks);
});
fastify.post("/tasks", async function(request, reply) {
  try {
    const { description } = request.body;
    if (!description) {
      return reply.status(400).send({
        error: "description required"
      });
    }
    const task = await prisma.task.create({
      data: {
        description
      }
    });
    return reply.status(201).send(task);
  } catch (error) {
    return reply.status(500).send({
      error: "Erro interno do servidor"
    });
  }
});
fastify.patch("/tasks/:id/toggle", async function(request, reply) {
  try {
    const { id } = request.params;
    if (!id) {
      return reply.status(400).send({
        error: "id required"
      });
    }
    const findTaks = await prisma.task.findFirst({
      where: {
        id
      }
    });
    if (!findTaks) {
      return reply.status(404).send({
        error: "taks not found"
      });
    }
    const task = await prisma.task.update({
      where: {
        id
      },
      data: {
        is_completed: !findTaks.is_completed
      }
    });
    return reply.send(task);
  } catch (error) {
    return reply.status(500).send({
      error: "Erro interno do servidor"
    });
  }
});
fastify.delete("/tasks/:id", async function(request, reply) {
  try {
    const { id } = request.params;
    await prisma.task.delete({
      where: {
        id
      }
    });
    return reply.status(204).send();
  } catch (error) {
    return reply.status(500).send({
      error: "Erro interno do servidor"
    });
  }
});
fastify.post("/ai/chat", async function(request, reply) {
  try {
    const { message } = request.body;
    if (!message) {
      return reply.code(400).send({ error: "message required" });
    }
    const currentTasks = await prisma.task.findMany();
    const prompt = `Voc\xEA \xE9 um assistente especializado em gerenciar lista de tarefas.

    TAREFAS ATUAIS DO USU\xC1RIO:
    ${JSON.stringify(currentTasks, null, 2)}

    INSTRU\xC7\xD5ES GERAIS:
    - Analise a solicita\xE7\xE3o do usu\xE1rio e identifique a a\xE7\xE3o desejada
    - Responda APENAS com um objeto JSON v\xE1lido, sem texto adicional
    - Use o formato exato abaixo:

    FORMATO DA RESPOSTA:
    {
      "action": "create" | "delete" | "complete" | "list" | "chat",
      "response": "string com mensagem apropriada",
      "data": [
        {
          "id": "string",
          "description": "string",
          "is_completed": boolean
        }
      ]
    }

    REGRAS DETALHADAS:

    1. PARA A\xC7\xC3O "list":
      - "response" deve listar TODAS as tarefas atuais no formato:
        "1 - Descri\xE7\xE3o da tarefa (conclu\xEDda)
2 - Outra tarefa (pendente)"
      - "data" deve conter o array COMPLETO de tarefas atuais
      - "is_completed" deve manter os valores originais de cada tarefa

    2. PARA A\xC7\xC3O "create":
      - "response": "Tarefa criada com sucesso"
      - "data" deve conter APENAS a NOVA tarefa criada
      - "is_completed": false para a nova tarefa
      - Gere um "id" \xFAnico (timestamp ou UUID simplificado)

    3. PARA A\xC7\xC3O "delete":
      - "response": "Tarefa(s) removida(s) com sucesso"
      - "data" deve conter TODAS as tarefas que SER\xC3O REMOVIDAS
      - Quando o usu\xE1rio pedir para "deletar tudo", "limpar tudo", "remover todas as tarefas":
        * "data" deve conter TODAS as tarefas atuais listadas acima
      - Quando o usu\xE1rio pedir para deletar tarefas espec\xEDficas:
        * Identifique as tarefas por posi\xE7\xE3o, descri\xE7\xE3o similar ou ID
        * "data" deve conter APENAS as tarefas identificadas
      - NUNCA retorne "data" como array vazio [] para a\xE7\xF5es de delete
      - Se n\xE3o conseguir identificar tarefas espec\xEDficas, inclua TODAS as tarefas atuais no "data"

    4. PARA A\xC7\xC3O "complete":
      - "response": "Tarefa conclu\xEDda"
      - "data" deve conter APENAS a tarefa que foi marcada como conclu\xEDda
      - "is_completed": true para a tarefa completada

    5. PARA A\xC7\xC3O "chat":
      - Use apenas quando for uma pergunta geral sobre tarefas
      - "response": resposta textual \xE0 pergunta do usu\xE1rio
      - "data": array vazio []

    RECONHECIMENTO DE SIN\xD4NIMOS:
    - CRIAR: "criar", "adicionar", "incluir", "nova tarefa", "adicionar nova"
    - DELETAR: "excluir", "remover", "apagar", "deletar", "tirar", "limpar tudo", "deletar tudo", "remover todas"
    - COMPLETAR: "concluir", "finalizar", "completar", "marcar como feita", "terminar"
    - LISTAR: "listar", "mostrar", "ver tarefas", "quais s\xE3o", "mostrar todas"

    IDENTIFICA\xC7\xC3O DE TAREFAS:
    - Por posi\xE7\xE3o: "primeira", "segunda", "\xFAltima", "n\xFAmero X"
    - Por similaridade: compare a descri\xE7\xE3o solicitada com as tarefas existentes
    - Por ID: se o usu\xE1rio mencionar ID espec\xEDfico

    EXEMPLOS:
    Usu\xE1rio: "Adicionar comprar leite"
    Resposta: {
      "action": "create",
      "response": "Tarefa criada com sucesso",
      "data": [
        {
          "id": "123456789",
          "description": "comprar leite",
          "is_completed": false
        }
      ]
    }

    Usu\xE1rio: "Deletar tudo"
    Resposta: {
      "action": "delete",
      "response": "Todas as tarefas removidas com sucesso",
      "data": [
        { "id": "1", "description": "Comprar p\xE3o", "is_completed": false },
        { "id": "2", "description": "Estudar React", "is_completed": true }
      ]
    }

    Usu\xE1rio: "Listar minhas tarefas"
    Resposta: {
      "action": "list",
      "response": "1 - Comprar p\xE3o (conclu\xEDda: false)
2 - Estudar React (conclu\xEDda: true)",
      "data": [
        { "id": "1", "description": "Comprar p\xE3o", "is_completed": false },
        { "id": "2", "description": "Estudar React", "is_completed": true }
      ]
    }
    `;
    const response = await fetch(`${process.env.API_GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.API_KEY_GROQ}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.MODEL_GROQ,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });
    const data = await response.json();
    const raw = data.choices[0]?.message.content || "";
    const jsonMatch = String(raw).match(/\{\s*"action"\s*:\s*"[^"]*"\s*,\s*"response"\s*:\s*"[^"]*"\s*,\s*"data"\s*:\s*\[[^\]]*\]\s*\}/);
    if (!jsonMatch) {
      throw new Error("Nenhum JSON v\xE1lido encontrado na resposta da IA");
    }
    const choices = JSON.parse(jsonMatch[0]);
    switch (choices.action) {
      case "create": {
        await prisma.task.createMany({
          data: [
            ...choices.data
          ]
        });
        break;
      }
      case "complete": {
        const tasksAddCheck = choices.data.filter((task) => task.is_completed).map((task) => task.id);
        const tasksRemoveCheck = choices.data.filter((task) => !task.is_completed).map((task) => task.id);
        if (tasksAddCheck.length > 0) {
          await prisma.task.updateMany({
            where: {
              id: { in: tasksAddCheck }
            },
            data: {
              is_completed: true
            }
          });
        }
        if (tasksRemoveCheck.length > 0) {
          await prisma.task.updateMany({
            where: {
              id: { in: tasksRemoveCheck }
            },
            data: {
              is_completed: false
            }
          });
        }
        break;
      }
      case "delete": {
        const idsTasks = choices.data.map((task) => task.id);
        await prisma.task.deleteMany({
          where: {
            id: { in: idsTasks }
          }
        });
        break;
      }
    }
    return reply.send(choices);
  } catch (error) {
    return reply.status(500).send({
      error: "Erro interno do servidor"
    });
  }
});
fastify.listen({ port: 3333 }, function(err) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
