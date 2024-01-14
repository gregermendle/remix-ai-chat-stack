import { MagicWandIcon, Pencil1Icon } from "@radix-ui/react-icons";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  isRouteErrorResponse,
  Link,
  useActionData,
  useRouteError,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askQuestion, type ChatResponse } from "~/chat.server";
import { requireUserId } from "~/session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireUserId(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const question = formData.get("question");

  if (typeof question !== "string" || question.length === 0) {
    return json(
      {
        question: null,
        related: null,
        errors: { question: "Question is required", title: null },
      },
      { status: 400 },
    );
  }

  const related = await askQuestion({ question, userId });

  return json({
    question,
    errors: null,
    related: related.map((note) => ({
      id: note.metadata.id,
      title: note.metadata.title,
    })),
  });
};

const isChatSseResponse = (resp: unknown): resp is ChatResponse => {
  return (
    resp != null &&
    typeof resp === "object" &&
    "type" in resp &&
    typeof resp.type === "string" &&
    ["start", "end", "token"].includes(resp.type)
  );
};

export default function NoteDetailsPage() {
  const actionData = useActionData<typeof action>();
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [bot, setBot] = useState({
    isResponding: false,
    response: "",
  });

  useEffect(() => {
    if (actionData?.errors?.question) {
      questionRef.current?.focus();
    }

    if (actionData?.errors === null) {
      formRef.current?.reset();
    }
  }, [actionData]);

  useEffect(() => {
    const eventSource = new EventSource("/api/sse", {
      withCredentials: true,
    });

    const updateResponses = (message: MessageEvent<string>) => {
      try {
        const json = JSON.parse(message.data);
        if (!isChatSseResponse(json)) return;

        if (json.type === "start") {
          setBot({
            response: "",
            isResponding: true,
          });
        } else if (json.type === "token") {
          setBot((_bot) => ({
            ..._bot,
            response: _bot.response + json.text,
          }));
        } else if (json.type === "end") {
          setBot((_bot) => ({
            ..._bot,
            isResponding: false,
          }));
        }
      } catch (e) {
        console.error("Failed to parse chat message JSON.");
      }
    };

    eventSource.addEventListener("chat", updateResponses);
    return () => {
      eventSource.close();
      eventSource.removeEventListener("chat", updateResponses);
    };
  }, []);

  return (
    <div>
      <h3 className="text-2xl font-bold">Chat</h3>
      <p className="py-6">Start chatting to ask questions about your notes.</p>
      {typeof actionData !== "undefined" ? (
        <div className="flex flex-col gap-2">
          <p className="font-semibold px-5 py-2 bg-muted/30 text-muted-foreground border rounded-md">
            You: {actionData?.question}
          </p>
          <p className="rounded-md bg-emerald-800/60 whitespace-pre-wrap px-5 py-2 border border-emerald-600">
            <MagicWandIcon className="inline-block" /> {bot.response}
            {bot.isResponding ? (
              <span className="inline-flex gap-0.5 items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse delay-75" />
                <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse delay-150" />
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
      <hr className="my-4" />
      <Form ref={formRef} method="post" className="flex flex-col gap-1">
        <div>
          <label htmlFor="question" className="flex w-full flex-col gap-1">
            <span>Question:</span>
            <Textarea
              ref={questionRef}
              name="question"
              id="question"
              disabled={bot.isResponding}
              rows={4}
              placeholder="Ask a question..."
              aria-invalid={actionData?.errors?.question ? true : undefined}
              aria-errormessage={
                actionData?.errors?.question ? "question-error" : undefined
              }
            />
          </label>
          {actionData?.errors?.question ? (
            <div className="pt-1 text-red-700" id="question-error">
              {actionData.errors.question}
            </div>
          ) : null}
        </div>

        <div className="text-right">
          <Button type="submit" disabled={bot.isResponding}>
            Send
          </Button>
        </div>
      </Form>
      {actionData?.related && actionData.related.length > 0 ? (
        <>
          <h3>Related Notes</h3>
          <hr className="my-4" />
          <ol className="space-y-2">
            {actionData.related.map((note) => (
              <li key={note.id}>
                <Link
                  className="block text-muted-foreground border rounded-md px-3 py-2 text-md"
                  to={`/notes/${note.id}`}
                >
                  <Pencil1Icon className="inline-block" /> {note.title}
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof Error) {
    return <div>An unexpected error occurred: {error.message}</div>;
  }

  if (!isRouteErrorResponse(error)) {
    return <h1>Unknown Error</h1>;
  }

  if (error.status === 404) {
    return <div>Note not found</div>;
  }

  return <div>An unexpected error occurred: {error.statusText}</div>;
}
