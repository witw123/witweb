import { describe, it, expect } from "vitest";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  apiErrorResponse,
} from "@/lib/api-response";
import { ApiError, ErrorCode } from "@/lib/api-error";

describe("API Response", () => {
  describe("successResponse", () => {
    it("should return success response with data", async () => {
      const data = { id: 1, name: "Test" };
      const response = successResponse(data);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });

    it("should return custom status code", () => {
      const response = successResponse({}, 201);
      expect(response.status).toBe(201);
    });
  });

  describe("createdResponse", () => {
    it("should return 201 status", async () => {
      const data = { id: 1 };
      const response = createdResponse(data);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });
  });

  describe("paginatedResponse", () => {
    it("should return paginated response", async () => {
      const items = [{ id: 1 }, { id: 2 }];
      const response = paginatedResponse(items, 100, 1, 10);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual(items);
      expect(body.data.total).toBe(100);
      expect(body.data.page).toBe(1);
      expect(body.data.size).toBe(10);
      expect(body.data.totalPages).toBe(10);
      expect(body.data.hasNext).toBe(true);
      expect(body.data.hasPrev).toBe(false);
    });

    it("should calculate hasNext and hasPrev correctly", async () => {
      const firstPage = paginatedResponse([], 100, 1, 10);
      const body1 = await firstPage.json();
      expect(body1.data.hasPrev).toBe(false);
      expect(body1.data.hasNext).toBe(true);

      const middlePage = paginatedResponse([], 100, 5, 10);
      const body2 = await middlePage.json();
      expect(body2.data.hasPrev).toBe(true);
      expect(body2.data.hasNext).toBe(true);

      const lastPage = paginatedResponse([], 100, 10, 10);
      const body3 = await lastPage.json();
      expect(body3.data.hasPrev).toBe(true);
      expect(body3.data.hasNext).toBe(false);
    });
  });

  describe("errorResponse", () => {
    it("should return error response with code and message", async () => {
      const response = errorResponse(ErrorCode.NOT_FOUND, "Not found");

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(body.error.message).toBe("Not found");
    });

    it("should include error details if provided", async () => {
      const details = { field: "username", issue: "already exists" };
      const response = errorResponse(ErrorCode.VALIDATION_ERROR, "Validation failed", details);

      const body = await response.json();
      expect(body.error.details).toEqual(details);
    });

    it("should map ApiError correctly", async () => {
      const error = new ApiError(ErrorCode.CONFLICT, "Already exists", { field: "name" });
      const response = apiErrorResponse(error);

      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ErrorCode.CONFLICT);
      expect(body.error.message).toBe("Already exists");
      expect(body.error.details).toEqual({ field: "name" });
    });

    it("should return 500 for generic INTERNAL_ERROR", async () => {
      const response = errorResponse(ErrorCode.INTERNAL_ERROR);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });
});
