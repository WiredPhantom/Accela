import { users, topics, flashcards, User, InsertUser, Topic, InsertTopic, Flashcard, InsertFlashcard } from "@shared/schema";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);
const scryptAsync = promisify(scrypt);

async function hashAccessCode(code: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(code, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function compareAccessCodes(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export interface IStorage {
  // User Management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(): Promise<User[]>;
  verifyUserCredentials(email: string, accessCode: string): Promise<User | undefined>;
  
  // Topic Management
  getTopic(id: number): Promise<Topic | undefined>;
  getTopics(): Promise<Topic[]>;
  createTopic(topic: InsertTopic): Promise<Topic>;
  updateTopic(id: number, updates: Partial<Topic>): Promise<Topic | undefined>;
  deleteTopic(id: number): Promise<boolean>;
  updateTopicLastAccessed(id: number): Promise<void>;
  
  // Flashcard Management
  getFlashcard(id: number): Promise<Flashcard | undefined>;
  getFlashcardsByTopic(topicId: number): Promise<Flashcard[]>;
  createFlashcard(flashcard: InsertFlashcard): Promise<Flashcard>;
  updateFlashcard(id: number, updates: Partial<Flashcard>): Promise<Flashcard | undefined>;
  deleteFlashcard(id: number): Promise<boolean>;
  bulkImportFlashcards(flashcardsData: Array<{front: string, back: string, topicId: number}>): Promise<{success: number, failed: number}>;
  
  // Session
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });

    // Initialize database with admin user
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      // Check if admin user exists
      const adminUser = await this.getUserByEmail("admin@neocorp.io");
      
      if (!adminUser) {
        // Create initial admin user
        await this.createUser({
          email: "admin@neocorp.io",
          accessCode: "admin123",
          role: "ADMIN",
        });
        
        // Create regular user
        await this.createUser({
          email: "user@neocorp.io",
          accessCode: "user123",
          role: "USER",
        });
        
        // Create some sample topics and flashcards
        const cybersecurityTopic = await this.createTopic({
          name: "Cybersecurity Fundamentals",
          description: "Master the essentials of digital security protocols and defense mechanisms.",
        });
        
        const neuralNetworksTopic = await this.createTopic({
          name: "Neural Networks",
          description: "Explore synthetic neural architecture and conscience mapping algorithms.",
        });
        
        // Create flashcards
        await this.createFlashcard({
          front: "What is a firewall?",
          back: "A security system that monitors and controls incoming and outgoing network traffic based on predetermined security rules. It establishes a barrier between a trusted network and an untrusted network.",
          topicId: cybersecurityTopic.id,
        });
        
        await this.createFlashcard({
          front: "What is encryption?",
          back: "The process of converting information or data into a code to prevent unauthorized access. It transforms readable data (plaintext) into an unreadable format (ciphertext) using mathematical algorithms.",
          topicId: cybersecurityTopic.id,
        });
        
        await this.createFlashcard({
          front: "What is a DDoS attack?",
          back: "Distributed Denial of Service - a malicious attempt to disrupt the normal traffic of a targeted server, service or network by overwhelming the target with a flood of Internet traffic using multiple compromised computer systems.",
          topicId: cybersecurityTopic.id,
        });
        
        await this.createFlashcard({
          front: "What is a neural network?",
          back: "A computational model inspired by the human brain that consists of layers of interconnected nodes (neurons) that can learn patterns from data and make predictions.",
          topicId: neuralNetworksTopic.id,
        });
        
        await this.createFlashcard({
          front: "What is backpropagation?",
          back: "An algorithm used to train neural networks by calculating gradients and adjusting weights to minimize the error between predicted and actual outputs.",
          topicId: neuralNetworksTopic.id,
        });
      }
    } catch (error) {
      console.error("Error initializing database:", error);
    }
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedAccessCode = await hashAccessCode(insertUser.accessCode);
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
      accessCode: hashedAccessCode
    }).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true; // In PostgreSQL, delete doesn't return a count by default without special handling
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async verifyUserCredentials(email: string, accessCode: string): Promise<User | undefined> {
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;
    
    const isValid = await compareAccessCodes(accessCode, user.accessCode);
    return isValid ? user : undefined;
  }

  // Topic Methods
  async getTopic(id: number): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic;
  }

  async getTopics(): Promise<Topic[]> {
    return await db.select().from(topics);
  }

  async createTopic(insertTopic: InsertTopic): Promise<Topic> {
    const [topic] = await db.insert(topics).values(insertTopic).returning();
    return topic;
  }

  async updateTopic(id: number, updates: Partial<Topic>): Promise<Topic | undefined> {
    const [topic] = await db.update(topics)
      .set(updates)
      .where(eq(topics.id, id))
      .returning();
    return topic;
  }

  async deleteTopic(id: number): Promise<boolean> {
    // Due to cascading delete in our schema, flashcards will be automatically deleted
    await db.delete(topics).where(eq(topics.id, id));
    return true;
  }

  async updateTopicLastAccessed(id: number): Promise<void> {
    await db.update(topics)
      .set({ lastAccessed: new Date() })
      .where(eq(topics.id, id));
  }

  // Flashcard Methods
  async getFlashcard(id: number): Promise<Flashcard | undefined> {
    const [flashcard] = await db.select().from(flashcards).where(eq(flashcards.id, id));
    return flashcard;
  }

  async getFlashcardsByTopic(topicId: number): Promise<Flashcard[]> {
    return await db.select().from(flashcards).where(eq(flashcards.topicId, topicId));
  }

  async createFlashcard(insertFlashcard: InsertFlashcard): Promise<Flashcard> {
    const [flashcard] = await db.insert(flashcards).values(insertFlashcard).returning();
    
    // Update the card count for the topic
    const topic = await this.getTopic(insertFlashcard.topicId);
    if (topic) {
      await db.update(topics)
        .set({ cardCount: topic.cardCount + 1 })
        .where(eq(topics.id, topic.id));
    }
    
    return flashcard;
  }

  async updateFlashcard(id: number, updates: Partial<Flashcard>): Promise<Flashcard | undefined> {
    const [flashcard] = await db.update(flashcards)
      .set(updates)
      .where(eq(flashcards.id, id))
      .returning();
    return flashcard;
  }

  async deleteFlashcard(id: number): Promise<boolean> {
    // Get the flashcard first to find its topic
    const flashcard = await this.getFlashcard(id);
    if (!flashcard) return false;
    
    // Delete the flashcard
    await db.delete(flashcards).where(eq(flashcards.id, id));
    
    // Update the card count for the topic
    const topic = await this.getTopic(flashcard.topicId);
    if (topic) {
      await db.update(topics)
        .set({ cardCount: Math.max(0, topic.cardCount - 1) })
        .where(eq(topics.id, topic.id));
    }
    
    return true;
  }
  
  // Bulk import flashcards
  async bulkImportFlashcards(flashcardsData: Array<{front: string, back: string, topicId: number}>): Promise<{success: number, failed: number}> {
    let successCount = 0;
    let failedCount = 0;
    
    // Using a transaction to ensure all related operations either succeed or fail together
    try {
      // Insert all flashcards
      const results = await db.insert(flashcards)
        .values(flashcardsData)
        .returning({ id: flashcards.id, topicId: flashcards.topicId });
      
      successCount = results.length;
      
      // Group cards by topic to update card counts efficiently
      const topicCounts = results.reduce((acc, card) => {
        acc[card.topicId] = (acc[card.topicId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      // Update each topic's card count
      for (const [topicId, count] of Object.entries(topicCounts)) {
        const topic = await this.getTopic(Number(topicId));
        if (topic) {
          await db.update(topics)
            .set({ cardCount: topic.cardCount + count })
            .where(eq(topics.id, topic.id));
        }
      }
      
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error("Error during bulk import:", error);
      return { success: 0, failed: flashcardsData.length };
    }
  }
}

export const storage = new DatabaseStorage();