import type { Note, User } from "@prisma/client";

import { addDocument, removeDocument } from "~/chat.server";
import { prisma } from "~/db.server";

export function getNote({
  id,
  userId,
}: Pick<Note, "id"> & {
  userId: User["id"];
}) {
  return prisma.note.findFirst({
    select: { id: true, body: true, title: true },
    where: { id, userId },
  });
}

export function getNoteListItems({ userId }: { userId: User["id"] }) {
  return prisma.note.findMany({
    where: { userId },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createNote({
  body,
  title,
  userId,
}: Pick<Note, "body" | "title"> & {
  userId: User["id"];
}) {
  const note = await prisma.note.create({
    data: {
      title,
      body,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });

  await addDocument(note);
  return note;
}

export function deleteNote({
  id,
  userId,
}: Pick<Note, "id"> & { userId: User["id"] }) {
  return Promise.all([
    prisma.note.deleteMany({
      where: { id, userId },
    }),
    removeDocument(id),
  ]);
}

export function getAllNotes() {
  return prisma.note.findMany({
    select: { id: true, body: true, title: true, userId: true },
  });
}
