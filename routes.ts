import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertTopicSchema, insertFlashcardSchema, insertUserSchema } from "@shared/schema";

// Helper function to ensure a user is authenticated
function ensureAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Helper function to ensure a user is an admin
function ensureAdmin(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated() || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);

  // API Routes
  // Topics
  app.get("/api/topics", ensureAuth, async (req, res) => {
    const topics = await storage.getTopics();
    res.json(topics);
  });

  app.get("/api/topics/:id", ensureAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const topic = await storage.getTopic(id);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    // Update last accessed time
    await storage.updateTopicLastAccessed(id);
    
    res.json(topic);
  });

  app.post("/api/topics", ensureAdmin, async (req, res) => {
    try {
      const data = insertTopicSchema.parse(req.body);
      const topic = await storage.createTopic(data);
      res.status(201).json(topic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.patch("/api/topics/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    try {
      const updates = insertTopicSchema.partial().parse(req.body);
      const topic = await storage.updateTopic(id, updates);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      res.json(topic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update topic" });
    }
  });

  app.delete("/api/topics/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const success = await storage.deleteTopic(id);
    if (!success) {
      return res.status(404).json({ message: "Topic not found" });
    }
    res.status(204).end();
  });

  // Flashcards
  app.get("/api/topics/:topicId/flashcards", ensureAuth, async (req, res) => {
    const topicId = parseInt(req.params.topicId);
    if (isNaN(topicId)) {
      return res.status(400).json({ message: "Invalid topic ID" });
    }

    const topic = await storage.getTopic(topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const flashcards = await storage.getFlashcardsByTopic(topicId);
    res.json(flashcards);
  });

  app.post("/api/topics/:topicId/flashcards", ensureAdmin, async (req, res) => {
    const topicId = parseInt(req.params.topicId);
    if (isNaN(topicId)) {
      return res.status(400).json({ message: "Invalid topic ID" });
    }

    const topic = await storage.getTopic(topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    try {
      const data = insertFlashcardSchema.omit({ topicId: true }).parse(req.body);
      const flashcard = await storage.createFlashcard({
        ...data,
        topicId,
      });
      res.status(201).json(flashcard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create flashcard" });
    }
  });

  app.patch("/api/topics/:topicId/flashcards/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    try {
      const updates = insertFlashcardSchema.omit({ topicId: true }).partial().parse(req.body);
      const flashcard = await storage.updateFlashcard(id, updates);
      if (!flashcard) {
        return res.status(404).json({ message: "Flashcard not found" });
      }
      res.json(flashcard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update flashcard" });
    }
  });

  app.delete("/api/topics/:topicId/flashcards/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const success = await storage.deleteFlashcard(id);
    if (!success) {
      return res.status(404).json({ message: "Flashcard not found" });
    }
    res.status(204).end();
  });

  // User Management (Admin Only)
  app.get("/api/users", ensureAdmin, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.post("/api/users", ensureAdmin, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      const user = await storage.createUser(data);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const success = await storage.deleteUser(id);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(204).end();
  });
  
  // Bulk Import Flashcards
  app.post("/api/topics/:topicId/bulk-import", ensureAdmin, async (req, res) => {
    const topicId = parseInt(req.params.topicId);
    if (isNaN(topicId)) {
      return res.status(400).json({ message: "Invalid topic ID" });
    }
    
    // Verify topic exists
    const topic = await storage.getTopic(topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }
    
    try {
      // Define a schema for bulk import
      const bulkImportSchema = z.array(
        z.object({
          front: z.string().min(1, "Front content is required"),
          back: z.string().min(1, "Back content is required"),
        })
      ).min(1, "At least one flashcard is required");
      
      // Validate the uploaded data
      const flashcardsData = bulkImportSchema.parse(req.body);
      
      // Add the topic ID to each flashcard
      const flashcardsWithTopic = flashcardsData.map(card => ({
        ...card,
        topicId
      }));
      
      // Perform the bulk import
      const result = await storage.bulkImportFlashcards(flashcardsWithTopic);
      
      res.status(201).json({
        message: `Successfully imported ${result.success} flashcards. Failed: ${result.failed}`,
        ...result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid flashcard data format", 
          details: error.errors 
        });
      }
      console.error("Bulk import error:", error);
      res.status(500).json({ message: "Failed to import flashcards" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
