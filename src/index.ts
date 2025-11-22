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
  action: 'create' | 'delete' | 'complete' | 'list' | 'chat';
  response: string;
  data: {
    id: string;
    description: string;
    is_completed: boolean;
  }[];
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

    const prompt = `Você é um assistente especializado em gerenciar lista de tarefas.

    TAREFAS ATUAIS DO USUÁRIO:
    ${JSON.stringify(currentTasks, null, 2)}

    INSTRUÇÕES GERAIS:
    - Analise a solicitação do usuário e identifique a ação desejada
    - Responda APENAS com um objeto JSON válido, sem texto adicional
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

    1. PARA AÇÃO "list":
      - "response" deve listar TODAS as tarefas atuais no formato:
        "1 - Descrição da tarefa (concluída)\n2 - Outra tarefa (pendente)"
      - "data" deve conter o array COMPLETO de tarefas atuais
      - "is_completed" deve manter os valores originais de cada tarefa

    2. PARA AÇÃO "create":
      - "response": "Tarefa criada com sucesso"
      - "data" deve conter APENAS a NOVA tarefa criada
      - "is_completed": false para a nova tarefa
      - Gere um "id" único (timestamp ou UUID simplificado)

    3. PARA AÇÃO "delete":
      - "response": "Tarefa(s) removida(s) com sucesso"
      - "data" deve conter TODAS as tarefas que SERÃO REMOVIDAS
      - Quando o usuário pedir para "deletar tudo", "limpar tudo", "remover todas as tarefas":
        * "data" deve conter TODAS as tarefas atuais listadas acima
      - Quando o usuário pedir para deletar tarefas específicas:
        * Identifique as tarefas por posição, descrição similar ou ID
        * "data" deve conter APENAS as tarefas identificadas
      - NUNCA retorne "data" como array vazio [] para ações de delete
      - Se não conseguir identificar tarefas específicas, inclua TODAS as tarefas atuais no "data"

    4. PARA AÇÃO "complete":
      - "response": "Tarefa concluída"
      - "data" deve conter APENAS a tarefa que foi marcada como concluída
      - "is_completed": true para a tarefa completada

    5. PARA AÇÃO "chat":
      - Use apenas quando for uma pergunta geral sobre tarefas
      - "response": resposta textual à pergunta do usuário
      - "data": array vazio []

    RECONHECIMENTO DE SINÔNIMOS:
    - CRIAR: "criar", "adicionar", "incluir", "nova tarefa", "adicionar nova"
    - DELETAR: "excluir", "remover", "apagar", "deletar", "tirar", "limpar tudo", "deletar tudo", "remover todas"
    - COMPLETAR: "concluir", "finalizar", "completar", "marcar como feita", "terminar"
    - LISTAR: "listar", "mostrar", "ver tarefas", "quais são", "mostrar todas"

    IDENTIFICAÇÃO DE TAREFAS:
    - Por posição: "primeira", "segunda", "última", "número X"
    - Por similaridade: compare a descrição solicitada com as tarefas existentes
    - Por ID: se o usuário mencionar ID específico

    EXEMPLOS:
    Usuário: "Adicionar comprar leite"
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

    Usuário: "Deletar tudo"
    Resposta: {
      "action": "delete",
      "response": "Todas as tarefas removidas com sucesso",
      "data": [
        { "id": "1", "description": "Comprar pão", "is_completed": false },
        { "id": "2", "description": "Estudar React", "is_completed": true }
      ]
    }

    Usuário: "Listar minhas tarefas"
    Resposta: {
      "action": "list",
      "response": "1 - Comprar pão (concluída: false)\n2 - Estudar React (concluída: true)",
      "data": [
        { "id": "1", "description": "Comprar pão", "is_completed": false },
        { "id": "2", "description": "Estudar React", "is_completed": true }
      ]
    }
    `;

    const response = await fetch(`${process.env.API_GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY_GROQ}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.MODEL_GROQ,
        response_format: { type: "json_object" },
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

    const jsonMatch = String(raw).match(/\{\s*"action"\s*:\s*"[^"]*"\s*,\s*"response"\s*:\s*"[^"]*"\s*,\s*"data"\s*:\s*\[[^\]]*\]\s*\}/);

    if (!jsonMatch) {
      throw new Error('Nenhum JSON válido encontrado na resposta da IA');
    }

    const choices: Content = JSON.parse(jsonMatch[0]);

    switch (choices.action) {
      case 'create': {
        await prisma.task.createMany({
          data: [
            ...choices.data
          ]
        });

        break;
      }
      case 'complete': {
        const tasksAddCheck = choices.data
          .filter(task => task.is_completed)
          .map(task => task.id);

        const tasksRemoveCheck = choices.data
          .filter(task => !task.is_completed)
          .map(task => task.id);

        if (tasksAddCheck.length > 0) {
          await prisma.task.updateMany({
            where: {
              id: {in: tasksAddCheck}
            },
            data: {
              is_completed: true
            }
          });
        }

        if (tasksRemoveCheck.length > 0) {
          await prisma.task.updateMany({
            where: {
              id: {in: tasksRemoveCheck}
            },
            data: {
              is_completed: false
            }
          });
        }

        break;
      }
      case 'delete': {
        const idsTasks = choices.data.map((task) => task.id);

        await prisma.task.deleteMany({
          where: {
            id: {in: idsTasks}
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
