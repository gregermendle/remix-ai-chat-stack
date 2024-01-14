import { CallbackManager } from "@langchain/core/callbacks/manager";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Note, User } from "@prisma/client";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { formatDocumentsAsString } from "langchain/util/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Subject } from "rxjs";
import invariant from "tiny-invariant";

import { getAllNotes } from "~/models/note.server";

invariant(
  typeof process.env.OPEN_AI_KEY === "string",
  "OPEN_AI_KEY must be set.",
);

const _model = new ChatOpenAI({
  streaming: true,
  openAIApiKey: process.env.OPEN_AI_KEY,
  modelName: process.env.OPEN_AI_MODEL_NAME ?? "gpt-3.5-turbo",
});

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 250,
  chunkOverlap: 0,
});

const createDocument = ({
  title,
  id,
  body,
  userId,
}: Pick<Note, "id" | "body" | "title" | "userId">) => ({
  pageContent: title + "\n" + body,
  metadata: { id, title, userId },
});

const createVectorStore = async () => {
  const notes = await getAllNotes();
  const splitDocs = await textSplitter.splitDocuments(
    notes.map(createDocument),
  );

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPEN_AI_KEY,
    modelName: "text-embedding-ada-002",
  });

  //
  // --- This is just an example, please dont do this in production
  // --- Instead you should store vectors in a vector database
  // --- A lightweight option could be sqlite-vss https://github.com/asg017/sqlite-vss
  //
  console.log("🤘 Creating embeddings...");
  return MemoryVectorStore.fromDocuments(splitDocs, embeddings);
};

const _vectorStore = createVectorStore();

async function addDocument(
  note: Pick<Note, "id" | "body" | "title" | "userId">,
) {
  const store = await _vectorStore;
  const splitDocs = await textSplitter.splitDocuments([createDocument(note)]);

  console.log("✨ Adding document to index.");
  return store.addDocuments(splitDocs);
}

async function removeDocument(id: Note["id"]) {
  const store = await _vectorStore;

  console.log("❌ Removing document from index.");
  store.memoryVectors = store.memoryVectors.filter(
    (doc) => doc.metadata.id !== id,
  );
}

const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the users question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
The following context originates from the users notes.
----------------
{context}`;

const messages = [
  SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
  HumanMessagePromptTemplate.fromTemplate("{question}"),
];

const prompt = ChatPromptTemplate.fromMessages(messages);

const chat$ = new Subject<ChatResponse>();

async function askQuestion({ question, userId }: ChatRequest) {
  const store = await _vectorStore;
  const sources = await store.similaritySearch(
    question,
    5,
    (doc) =>
      // --- This filter will look different depending on your vector store
      typeof doc.metadata.userId === "string" && doc.metadata.userId === userId,
  );

  const chain = RunnableSequence.from([
    {
      context: (input) => formatDocumentsAsString(input.sources),
      question: (input) => input.question,
    },
    prompt,
    _model,
    new StringOutputParser(),
  ]);

  chain.invoke(
    { sources, question },
    {
      callbacks: CallbackManager.fromHandlers({
        handleLLMNewToken: (text) =>
          chat$.next({ type: "token", text, userId }),
        handleLLMError: (e) =>
          chat$.next({
            type: "error",
            userId,
            error:
              typeof e === "string"
                ? e
                : e instanceof Error
                ? e.message
                : "An error occurred please try again.",
          }),
        handleLLMStart: () =>
          chat$.next({
            type: "start",
            userId,
          }),
        handleLLMEnd: () =>
          chat$.next({
            type: "end",
            userId,
          }),
      }),
    },
  );

  return sources;
}

//
// --- Chat Types
//

interface ChatTokenResponse {
  type: "token";
  text: string;
  userId: User["id"];
}

interface ChatStartResponse {
  type: "start";
  userId: User["id"];
}

interface ChatEndResponse {
  type: "end";
  userId: User["id"];
}

interface ChatErrorResponse {
  type: "error";
  error: string;
  userId: User["id"];
}

type ChatResponse =
  | ChatTokenResponse
  | ChatStartResponse
  | ChatEndResponse
  | ChatErrorResponse;

interface ChatRequest {
  question: string;
  userId: User["id"];
}

export {
  askQuestion,
  chat$,
  addDocument,
  removeDocument,
  type ChatRequest,
  type ChatResponse,
};
