import cors from '@fastify/cors';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { prisma } from "./lib/prisma.js";

const fastify = Fastify({
  logger: true
});

fastify.register(cors, {
  origin: '*',
  methods: '*'
})

fastify.get('/tasks', async function (_request, reply: FastifyReply) {
  const tasks = await prisma.task.findMany()

  return reply.send(tasks)
});

interface TaskBody {
  description: string;
  is_completed?: boolean;
}

fastify.post('/tasks', async function (request: FastifyRequest<{Body: TaskBody}>, reply: FastifyReply) {
  try {
    const { description } = request.body;

    if (!description) {
      return reply.status(400).send({
        error: 'description required'
      });
    }

    const task = await prisma.task.create({
      data: {
        description: description,
      }
    });

    return reply.status(201).send(task);
  } catch (error) {

    return reply.status(500).send({
      error: 'Erro interno do servidor'
    });
  }
});

interface TaskParams {
  id: string;
}

fastify.patch('/tasks/:id/toggle', async function(request: FastifyRequest<{Params: TaskParams}>, reply: FastifyReply) {
  try {
    const {id} = request.params;

    if (!id) {
      return reply.status(400).send({
        error: 'id required'
      });
    }

    const findTaks = await prisma.task.findFirst({
      where: {
        id
      }
    });

    if (!findTaks) {
      return reply.status(404).send({
        error: 'taks not found'
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
      error: 'Erro interno do servidor'
    });
  }
})

fastify.delete('/tasks/:id', async function(request: FastifyRequest<{Params: TaskParams}>, reply: FastifyReply) {
  try {
    const {id} = request.params;

    await prisma.task.delete({
      where: {
        id
      }
    });

    return reply.status(204).send();
  } catch (error) {

    return reply.status(500).send({
      error: 'Erro interno do servidor'
    });
  }
});

interface ChatBody {
  message: string;
}
interface Content {
  action: 'create' | 'delete' | 'complete';
  response: string;
  data: {
    id: string;
    description: string;
    is_completed: boolean;
  }
}

interface Message {
  role: 'assistant' | 'user' | 'system';
  content: Content | string;
}

interface Choice {
  index: number;
  message: Message;
  logprobs: null | unknown;
  finish_reason: string;
}

interface OpenAIResponse {
  choices: Choice[];
}

fastify.post('/ai/chat', async function (request: FastifyRequest<{Body: ChatBody}>, reply: FastifyReply) {
  try {
    const {message} = request.body;

    if (!message) {
      return reply.code(400).send({ error: 'message required' });
    }

    const currentTasks = await prisma.task.findMany()

    const prompt = `Você é um assistente que ajuda a gerenciar uma lista de tarefas.

    Tarefas atuais: ${JSON.stringify(currentTasks)}

    Interprete a solicitação do usuário e responda APENAS com um JSON no formato:
    {
      "action": "create" | "delete" | "complete" | "list",
      "response": string,
      data: {
        "id": string,
        "description": string,
        "is_completed": boolean
      }
    }

    Regras para o campo "is_completed":
    - Deve ser true quando a ação for "complete".
    - Deve ser false para ações "create", "delete", "list" e "chat".

    Reconheça sinônimos:
    - criar / adicionar / incluir / nova tarefa
    - excluir / remover / apagar / deletar
    - concluir / finalizar / completar / marcar como feita
    - listar / mostrar / ver tarefas

    Para identificar qual tarefa, procure por nome similar ou posição.

    Não é permitido executar ações envolvendo múltiplas tarefas na mesma requisição. Cada operação deve ser realizada individualmente.
    Se o usuário mencionar mais de uma tarefa em uma única mensagem, o assistente deve retornar um aviso informando que apenas uma tarefa pode ser manipulada por vez.`;

    const response = await fetch(`${process.env.API_GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY_GROQ}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.MODEL_GROQ,
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: message
          }
        ]
      }),
    });
    const data: OpenAIResponse = await response.json();

    const raw = data.choices[0]?.message.content || '';

    const jsonMatch = String(raw).match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Nenhum JSON válido encontrado na resposta da IA');
    }

    const choices: Content = JSON.parse(jsonMatch[0]);

    switch (choices.action) {
      case 'create': {
        await prisma.task.create({
          data: {
            description: choices.data.description,
            is_completed: choices.data.is_completed
          }
        });

        break;
      }
      case 'complete': {
        await prisma.task.update({
          where: {
            id: choices.data.id
          },
          data: {
            is_completed: choices.data.is_completed
          }
        });

        break;
      }
      case 'delete': {
        await prisma.task.delete({
          where: {
            id: choices.data.id
          }
        });

        break;
      }
    }

    return reply.send(choices);
  } catch (error) {
    return reply.status(500).send({
      error: 'Erro interno do servidor'
    });
  }
});

fastify.listen({ port: 3333 }, function (err) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
});
