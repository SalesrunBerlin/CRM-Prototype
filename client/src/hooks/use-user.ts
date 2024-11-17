import useSWR from "swr";
import type { User, InsertUser } from "db/schema";

export function useUser() {
  const { data, error, mutate } = useSWR<User, Error>("/api/user", {
    revalidateOnFocus: false,
  });

  return {
    user: data,
    isLoading: !error && !data,
    error,
    login: async (user: InsertUser) => {
      const res = await handleRequest("/api/auth/login", "POST", user);
      mutate();
      return res;
    },
    logout: async () => {
      const res = await handleRequest("/api/auth/logout", "POST");
      mutate(undefined);
      return res;
    },
    register: async (user: InsertUser) => {
      const res = await handleRequest("/api/auth/register", "POST", user);
      mutate();
      return res;
    },
  };
}

type RequestResult =
  | {
      ok: true;
      user?: Omit<User, "password">;
      message?: string;
    }
  | {
      ok: false;
      message: string;
    };

async function handleRequest(
  url: string,
  method: string,
  body?: InsertUser
): Promise<RequestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { ok: false, message: data.message };
    }

    return { ok: true, ...data };
  } catch (e: any) {
    return { ok: false, message: e.toString() };
  }
}
