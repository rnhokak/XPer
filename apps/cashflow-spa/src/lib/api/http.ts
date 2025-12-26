import ky from "ky";

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const http = ky.create({
  prefixUrl: "",
  credentials: "include",
  throwHttpErrors: false,
  hooks: {
    afterResponse: [
      async (_request, _options, response) => {
        if (response.ok) return;

        let data: unknown = null;
        try {
          data = await response.clone().json();
        } catch {
          try {
            data = await response.clone().text();
          } catch {
            data = null;
          }
        }

        const message =
          typeof data === "object" && data && "error" in data
            ? String((data as { error?: string }).error)
            : response.statusText || "Request failed";

        throw new ApiError(message, response.status, data ?? undefined);
      },
    ],
  },
});
