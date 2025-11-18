import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { prisma } from "./lib/prisma.js";

const fastify = Fastify({
  logger: true
});

fastify.get('/tasks', async function (_request, reply: FastifyReply) {
  const tasks = await prisma.task.findMany()

  return reply.send(tasks)
});

interface TaskBody {
  title: string;
}

fastify.post('/tasks', async function (request: FastifyRequest<{Body: TaskBody}>, reply: FastifyReply) {
  try {
    const { title } = request.body;

    if (!title) {
      return reply.status(400).send({
        error: 'title required'
      });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim()
      }
    });

    return reply.status(201).send(task);
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);

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
        checked: !findTaks.checked
      }
    });

    return reply.send(task);
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);

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
    console.error('Erro ao criar tarefa:', error);

    return reply.status(500).send({
      error: 'Erro interno do servidor'
    });
  }
});

fastify.listen({ port: 3000 }, function (err) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
});
