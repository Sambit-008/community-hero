import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "community_hero.db");

// Ensure the directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize better-sqlite3 database
export const db = new Database(DB_FILE, { verbose: console.log });

// Enable foreign key support
db.pragma("foreign_keys = ON");

// Define TypeScript interfaces for our application
export interface AIAnalysis {
  confidence: number;
  riskAssessment: string;
  priorityScore: number;
  citizenSafetyAdvice: string;
  suggestedResolution: string;
  estimatedResolutionDays: number;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  department: string;
  status: "Reported" | "Analyzed" | "Verified" | "In Progress" | "Resolved" | "Closed";
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  imageUrl: string;
  reportedBy: string;
  reportedAt: string;
  upvotes: number;
  downvotes: number;
  verifiedBy: string[];
  aiAnalysis: AIAnalysis | null;
  summary: string | null;
  actionPlan: string[] | null;
}

export interface Comment {
  id: string;
  complaintId: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface ActivityLog {
  id: number;
  complaintId: string | null;
  action: string;
  description: string;
  userId: string;
  timestamp: string;
}

// Initialize tables
export function initDB() {
  console.log("Initializing SQLite database tables...");

  // 1. Complaints Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Reported',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      reportedBy TEXT NOT NULL,
      reportedAt TEXT NOT NULL,
      upvotes INTEGER DEFAULT 1,
      downvotes INTEGER DEFAULT 0,
      summary TEXT,
      actionPlan TEXT
    )
  `).run();

  // 2. AI Analysis Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaintId TEXT UNIQUE,
      confidence REAL NOT NULL,
      riskAssessment TEXT NOT NULL,
      priorityScore INTEGER NOT NULL,
      citizenSafetyAdvice TEXT NOT NULL,
      suggestedResolution TEXT NOT NULL,
      estimatedResolutionDays INTEGER NOT NULL,
      FOREIGN KEY (complaintId) REFERENCES complaints(id) ON DELETE CASCADE
    )
  `).run();

  // 3. Verification Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS verification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaintId TEXT NOT NULL,
      userId TEXT NOT NULL,
      type TEXT NOT NULL, -- 'upvote' or 'downvote'
      createdAt TEXT NOT NULL,
      FOREIGN KEY (complaintId) REFERENCES complaints(id) ON DELETE CASCADE,
      UNIQUE(complaintId, userId)
    )
  `).run();

  // 4. Activity Logs Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaintId TEXT,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      userId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (complaintId) REFERENCES complaints(id) ON DELETE SET NULL
    )
  `).run();

  // 5. Comments Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      complaintId TEXT NOT NULL,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (complaintId) REFERENCES complaints(id) ON DELETE CASCADE
    )
  `).run();

  // Seed data if complaints table is completely empty or contains Seattle data
  const countRow = db.prepare("SELECT COUNT(*) as count FROM complaints").get() as { count: number };
  let needsSeeding = countRow.count === 0;
  if (!needsSeeding) {
    const sampleRow = db.prepare("SELECT address FROM complaints LIMIT 1").get() as { address: string } | undefined;
    if (sampleRow && (sampleRow.address.includes("Seattle") || sampleRow.address.includes("WA"))) {
      console.log("Detected old Seattle seed data. Clearing and reseeding with Indian civic complaints...");
      db.prepare("DELETE FROM comments").run();
      db.prepare("DELETE FROM verification").run();
      db.prepare("DELETE FROM ai_analysis").run();
      db.prepare("DELETE FROM activity_logs").run();
      db.prepare("DELETE FROM complaints").run();
      needsSeeding = true;
    }
  }
  if (needsSeeding) {
    console.log("Seeding initial Indian municipal operations data...");
    seedInitialData();
  }
}

// Private helper to seed initial data
function seedInitialData() {
  const SEED_COMPLAINTS = [
    {
      id: "complaint_1",
      title: "Deep Monsoon Pothole on SV Road near Bandra West Station",
      description: "A very large, deep pothole has formed right in the middle of SV Road near the Bandra West station traffic signal. It is forcing auto-rickshaws and two-wheelers to swerve suddenly, creating a severe traffic hazard, especially during night hours and rainy conditions.",
      category: "Pothole",
      severity: "Critical",
      department: "Public Works",
      status: "In Progress",
      lat: 19.0544,
      lng: 72.8402,
      address: "S.V. Road, near Bandra West Station, Mumbai, Maharashtra 400050",
      imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Rahul Sharma",
      reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 58,
      downvotes: 2,
      verifiedBy: ["user_1", "user_2"],
      aiAnalysis: {
        confidence: 0.95,
        riskAssessment: "Extremely high collision hazard. Swerving vehicles pose an immediate threat to two-wheelers and pedestrians. Standing rainwater makes the pothole depth invisible to oncoming traffic.",
        priorityScore: 94,
        citizenSafetyAdvice: "Reduce vehicle speed to under 15 km/h when crossing this block. Motorcyclists should merge to the center lane to safely bypass.",
        suggestedResolution: "Requires full emergency asphalt filling, sealing, and compaction. Cold-mix aggregate can be used as an immediate temporary fix during rains.",
        estimatedResolutionDays: 1
      },
      summary: "Official Notice of Civic Hazard: SV Road Pothole\n\nThis report documents a critical asphalt failure (pothole) measuring roughly 4 feet in width and 8 inches in depth at SV Road, Bandra West. Immediate excavation, structural aggregate base stabilization, and cold-mix asphalt leveling are recommended within 24 hours to mitigate liability and secure citizen safety.",
      actionPlan: [
        "Deploy localized reflective hazard barricades and warning boards around the cavity.",
        "Dispatch BMC road maintenance crew with cold-mix asphalt and compaction gear.",
        "Pump out standing water and perform a clean cutout around the structural cavity.",
        "Fill with high-performance instant cold-asphalt mix and compact.",
        "Conduct a final quality check to ensure a leveled road surface."
      ]
    },
    {
      id: "complaint_2",
      title: "Overflowing Municipal Garbage Vat near Lajpat Nagar Market",
      description: "The primary MCD garbage bin near Lajpat Nagar II market is completely overflowing. Garbage is spilled over half the active road, blocking pedestrian walkways, attracting stray animals, and giving off an extremely strong, unhygienic odor.",
      category: "Garbage Dumping",
      severity: "High",
      department: "Sanitation",
      status: "Verified",
      lat: 28.5672,
      lng: 77.2435,
      address: "Block K, Lajpat Nagar II, New Delhi, Delhi 110024",
      imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Amit Verma",
      reportedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 34,
      downvotes: 1,
      verifiedBy: ["user_1"],
      aiAnalysis: {
        confidence: 0.89,
        riskAssessment: "Public health and hygiene hazard. Severe pedestrian blockage forcing citizens to walk on the busy main road. Risk of disease vectors in a heavily populated commercial zone.",
        priorityScore: 86,
        citizenSafetyAdvice: "Avoid walking through the scattered debris. Keep a safe distance from stray animals feeding around the vat.",
        suggestedResolution: "Deploy sanitation vehicle and mechanical compactor for heavy bulk waste pick-up. Set up an regular morning clearance schedule.",
        estimatedResolutionDays: 1
      },
      summary: null,
      actionPlan: null
    },
    {
      id: "complaint_3",
      title: "BWSSB Main Water Pipe Burst Causing Flooding in Indiranagar",
      description: "A drinking water main pipeline has burst near 100 Feet Road, Indiranagar. Thousands of liters of clean water are spraying constantly onto the roadway, creating massive pools, eroding the road foundation, and flooding building basements.",
      category: "Water Leakage",
      severity: "High",
      department: "Water Authority",
      status: "Reported",
      lat: 12.9716,
      lng: 77.6412,
      address: "100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038",
      imageUrl: "https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Priya Nair",
      reportedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      upvotes: 25,
      downvotes: 0,
      verifiedBy: [],
      aiAnalysis: {
        confidence: 0.94,
        riskAssessment: "Severe municipal drinking water wastage. Risk of localized roadbed erosion, undermining the sub-base of the road. Potential hydroplaning risk for motorists.",
        priorityScore: 88,
        citizenSafetyAdvice: "Do not attempt to walk through the pressurized spray area. Keep a safe distance as pressure may release unpredictably.",
        suggestedResolution: "Dispatch BWSSB utility team to shut off the local main gate valve, replace the ruptured pipe joint, and clear storm water drains.",
        estimatedResolutionDays: 1
      },
      summary: null,
      actionPlan: null
    },
    {
      id: "complaint_4",
      title: "Dysfunctional Streetlights near Gariahat Crossing Stretch",
      description: "All streetlights on Gariahat Road between the crossing and the flyover are dysfunctional. The entire stretch is in total darkness after sunset, making it extremely unsafe for pedestrians and causing low driver visibility.",
      category: "Broken Streetlight",
      severity: "High",
      department: "Electricity & Power",
      status: "In Progress",
      lat: 22.5180,
      lng: 88.3655,
      address: "Gariahat Road, near Gariahat Crossing, Kolkata, West Bengal 700019",
      imageUrl: "https://images.unsplash.com/photo-1509024644558-2f56ce76c490?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Sourav Das",
      reportedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 19,
      downvotes: 0,
      verifiedBy: ["user_3"],
      aiAnalysis: {
        confidence: 0.91,
        riskAssessment: "Elevated risk of accidents and personal safety incidents. Danger to evening pedestrians from unseen road cracks and low vehicle driver visibility.",
        priorityScore: 82,
        citizenSafetyAdvice: "Carry a flashlight or use your phone's LED when walking. Walk in groups or use alternative well-lit lanes if possible.",
        suggestedResolution: "Inspect local feeder pillar box and replace blown fuses or damaged LED luminaire drivers across the block stretch.",
        estimatedResolutionDays: 2
      },
      summary: null,
      actionPlan: null
    },
    {
      id: "complaint_5",
      title: "Open Storm Water Manhole on Usman Road, T. Nagar",
      description: "An open storm water manhole has been left completely uncovered on Usman Road under the flyover. It is right on the pedestrian path and is extremely hazardous, especially in the evening when visibility is low. No warning signs are present.",
      category: "Other",
      severity: "Critical",
      department: "Sewage Board",
      status: "Reported",
      lat: 13.0324,
      lng: 80.2337,
      address: "Usman Road, T. Nagar, Chennai, Tamil Nadu 600017",
      imageUrl: "https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Karthik R.",
      reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      upvotes: 48,
      downvotes: 0,
      verifiedBy: [],
      aiAnalysis: {
        confidence: 0.96,
        riskAssessment: "Extremely fatal hazard for pedestrians and cyclists, especially children. High probability of falling into the deep sewer line, particularly during waterlogging.",
        priorityScore: 96,
        citizenSafetyAdvice: "Avoid walking on the unlit footpath under the flyover. Cross on the opposite side where paths are completely clear.",
        suggestedResolution: "Immediately cordon off the manhole with caution tape. Fabricate and install a heavy-duty reinforced concrete (RCC) manhole cover.",
        estimatedResolutionDays: 1
      },
      summary: null,
      actionPlan: null
    },
    {
      id: "complaint_6",
      title: "Choked Sewer Line and Drainage Overflow near Mindspace Junction",
      description: "A major sewer line is choked near the Mindspace IT Park junction, causing black sewage water to overflow onto the main road. The foul-smelling water has pooled around the bus stop, making it impossible for commuters to board.",
      category: "Drainage Blockage",
      severity: "High",
      department: "Sewage Board",
      status: "Verified",
      lat: 17.4415,
      lng: 78.3826,
      address: "Hitech City Road, near Mindspace Junction, Hyderabad, Telangana 500081",
      imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Vikram Reddy",
      reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 31,
      downvotes: 1,
      verifiedBy: ["user_1"],
      aiAnalysis: {
        confidence: 0.93,
        riskAssessment: "Severe biological and environmental hazard. Flooded sewage causes pathogens to spread. Impedes traffic at a major technological hub.",
        priorityScore: 89,
        citizenSafetyAdvice: "Do not walk bare-legged or with open footwear in the sewage water. Commuters should use alternative transit pick-up points.",
        suggestedResolution: "Deploy a high-pressure jetting and suction machine to clear the plastic and sludge blockage in the main sewer line.",
        estimatedResolutionDays: 2
      },
      summary: null,
      actionPlan: null
    },
    {
      id: "complaint_7",
      title: "Illegal Dumping of Industrial Plastic Waste along Mula Mutha Riverbank",
      description: "Large-scale illegal dumping of industrial plastic scraps and construction waste is taking place along the riverbank of Mula Mutha in Kalyani Nagar. This is polluting the river ecosystem, causing a massive eyesore, and blockading natural water flow.",
      category: "Garbage Dumping",
      severity: "High",
      department: "Sanitation",
      status: "In Progress",
      lat: 18.5481,
      lng: 73.9015,
      address: "Riverside Road, Kalyani Nagar, Pune, Maharashtra 411006",
      imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Ananya Joshi",
      reportedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 29,
      downvotes: 0,
      verifiedBy: [],
      aiAnalysis: {
        confidence: 0.90,
        riskAssessment: "Extreme ecological damage. Microplastics entering the water bodies. Potential river blockades leading to flash floods during intense downpours.",
        priorityScore: 85,
        citizenSafetyAdvice: "Report any night-dumping truck license plates directly to the Pune Municipal Corporation. Avoid contacting the water.",
        suggestedResolution: "Execute a riverbank cleanup drive. Install night-vision CCTV cameras and concrete barriers to block truck access to the riverside.",
        estimatedResolutionDays: 3
      },
      summary: null,
      actionPlan: null
    },
    {
      id: "complaint_8",
      title: "Extensively Cracked and Damaged Road on Ashram Road stretch",
      description: "A long stretch of Ashram Road near Sabarmati Riverfront has developed massive deep cracks and top-layer erosion. The surface is extremely bumpy and uneven, leading to frequent vehicle breakdowns.",
      category: "Road Damage",
      severity: "Medium",
      department: "Public Works",
      status: "Reported",
      lat: 23.0392,
      lng: 72.5714,
      address: "Ashram Road, near Sabarmati Riverfront, Ahmedabad, Gujarat 380009",
      imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=800",
      reportedBy: "Hardik Patel",
      reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 14,
      downvotes: 0,
      verifiedBy: [],
      aiAnalysis: {
        confidence: 0.88,
        riskAssessment: "Gradual structural breakdown of a major artery road. High probability of alignment damage to light vehicles. Increased noise and dust pollution.",
        priorityScore: 68,
        citizenSafetyAdvice: "Maintain a steady speed of under 30 km/h. Avoid sharp lane changes on the damaged stretch.",
        suggestedResolution: "Milling of the cracked top layer followed by resurfacing with a 40mm thick layer of stone mastic asphalt.",
        estimatedResolutionDays: 4
      },
      summary: null,
      actionPlan: null
    }
  ];

  const SEED_COMMENTS = [
    {
      id: "comment_1",
      complaintId: "complaint_1",
      author: "Jessica M.",
      text: "Nearly destroyed my suspension on this pothole yesterday! Please fix this ASAP.",
      createdAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "comment_2",
      complaintId: "complaint_1",
      author: "Auto Driver Vinod",
      text: "Two-wheelers are skidding here every hour since it started raining. Very dangerous!",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "comment_3",
      complaintId: "complaint_2",
      author: "Local Shopkeeper",
      text: "The trash pile has doubled in size. Rats are already roaming around. Highly unhygienic.",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // Insert seed complaints
  const insertComplaint = db.prepare(`
    INSERT INTO complaints (
      id, title, description, category, severity, department, status,
      lat, lng, address, imageUrl, reportedBy, reportedAt, upvotes, downvotes, summary, actionPlan
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAI = db.prepare(`
    INSERT INTO ai_analysis (
      complaintId, confidence, riskAssessment, priorityScore, citizenSafetyAdvice, suggestedResolution, estimatedResolutionDays
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVerification = db.prepare(`
    INSERT INTO verification (complaintId, userId, type, createdAt) VALUES (?, ?, ?, ?)
  `);

  const insertComment = db.prepare(`
    INSERT INTO comments (id, complaintId, author, text, createdAt) VALUES (?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO activity_logs (complaintId, action, description, userId, timestamp) VALUES (?, ?, ?, ?, ?)
  `);

  // Run as a single transaction
  const transaction = db.transaction(() => {
    for (const c of SEED_COMPLAINTS) {
      insertComplaint.run(
        c.id,
        c.title,
        c.description,
        c.category,
        c.severity,
        c.department,
        c.status,
        c.lat,
        c.lng,
        c.address,
        c.imageUrl,
        c.reportedBy,
        c.reportedAt,
        c.upvotes,
        c.downvotes,
        c.summary,
        c.actionPlan ? JSON.stringify(c.actionPlan) : null
      );

      if (c.aiAnalysis) {
        insertAI.run(
          c.id,
          c.aiAnalysis.confidence,
          c.aiAnalysis.riskAssessment,
          c.aiAnalysis.priorityScore,
          c.aiAnalysis.citizenSafetyAdvice,
          c.aiAnalysis.suggestedResolution,
          c.aiAnalysis.estimatedResolutionDays
        );
      }

      for (const u of c.verifiedBy) {
        insertVerification.run(c.id, u, "upvote", c.reportedAt);
      }

      insertLog.run(
        c.id,
        "CREATED",
        `Civic complaint created by ${c.reportedBy}.`,
        c.reportedBy === "Anonymous Citizen" ? "anonymous" : "user_seed",
        c.reportedAt
      );
    }

    for (const com of SEED_COMMENTS) {
      insertComment.run(com.id, com.complaintId, com.author, com.text, com.createdAt);
      insertLog.run(
        com.complaintId,
        "COMMENT_ADDED",
        `New community feedback left by ${com.author}.`,
        "user_seed",
        com.createdAt
      );
    }
  });

  transaction();
  console.log("Seeding complete!");
}

// Database Helper CRUD Operations

/**
 * Fetch all complaints with their joined AI Analysis and verification user lists
 */
export function getAllComplaints(): Complaint[] {
  const rows = db.prepare(`
    SELECT c.*,
           a.confidence, a.riskAssessment, a.priorityScore, a.citizenSafetyAdvice, a.suggestedResolution, a.estimatedResolutionDays
    FROM complaints c
    LEFT JOIN ai_analysis a ON c.id = a.complaintId
    ORDER BY c.reportedAt DESC
  `).all() as any[];

  return rows.map(row => mapRowToComplaint(row));
}

/**
 * Fetch a single complaint by its unique identifier
 */
export function getComplaintById(id: string): Complaint | null {
  const row = db.prepare(`
    SELECT c.*,
           a.confidence, a.riskAssessment, a.priorityScore, a.citizenSafetyAdvice, a.suggestedResolution, a.estimatedResolutionDays
    FROM complaints c
    LEFT JOIN ai_analysis a ON c.id = a.complaintId
    WHERE c.id = ?
  `).get(id) as any;

  if (!row) return null;
  return mapRowToComplaint(row);
}

/**
 * Helper to map flat database join rows to rich client Complaint objects
 */
function mapRowToComplaint(row: any): Complaint {
  // Query verification list for this complaint
  const verifications = db.prepare("SELECT userId FROM verification WHERE complaintId = ?").all(row.id) as { userId: string }[];
  const verifiedBy = verifications.map(v => v.userId);

  let aiAnalysis: AIAnalysis | null = null;
  if (row.confidence !== undefined && row.confidence !== null) {
    aiAnalysis = {
      confidence: row.confidence,
      riskAssessment: row.riskAssessment || "",
      priorityScore: row.priorityScore || 0,
      citizenSafetyAdvice: row.citizenSafetyAdvice || "",
      suggestedResolution: row.suggestedResolution || "",
      estimatedResolutionDays: row.estimatedResolutionDays || 0
    };
  }

  let actionPlan: string[] | null = null;
  if (row.actionPlan) {
    try {
      actionPlan = JSON.parse(row.actionPlan);
    } catch (e) {
      console.error("Failed to parse actionPlan for complaint", row.id, e);
    }
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    department: row.department,
    status: row.status,
    location: {
      lat: row.lat,
      lng: row.lng,
      address: row.address
    },
    imageUrl: row.imageUrl,
    reportedBy: row.reportedBy,
    reportedAt: row.reportedAt,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    verifiedBy,
    aiAnalysis,
    summary: row.summary,
    actionPlan
  };
}

/**
 * Insert a new complaint with its corresponding optional AI Analysis record
 */
export function createComplaint(complaint: Complaint): boolean {
  const insertComplaintStmt = db.prepare(`
    INSERT INTO complaints (
      id, title, description, category, severity, department, status,
      lat, lng, address, imageUrl, reportedBy, reportedAt, upvotes, downvotes, summary, actionPlan
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAIStmt = db.prepare(`
    INSERT INTO ai_analysis (
      complaintId, confidence, riskAssessment, priorityScore, citizenSafetyAdvice, suggestedResolution, estimatedResolutionDays
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLogStmt = db.prepare(`
    INSERT INTO activity_logs (complaintId, action, description, userId, timestamp) VALUES (?, ?, ?, ?, ?)
  `);

  // Insert initial verification record for reporter
  const insertVerificationStmt = db.prepare(`
    INSERT OR IGNORE INTO verification (complaintId, userId, type, createdAt) VALUES (?, ?, 'upvote', ?)
  `);

  const transaction = db.transaction(() => {
    insertComplaintStmt.run(
      complaint.id,
      complaint.title,
      complaint.description,
      complaint.category,
      complaint.severity,
      complaint.department,
      complaint.status,
      complaint.location.lat,
      complaint.location.lng,
      complaint.location.address,
      complaint.imageUrl,
      complaint.reportedBy,
      complaint.reportedAt,
      complaint.upvotes,
      complaint.downvotes,
      complaint.summary,
      complaint.actionPlan ? JSON.stringify(complaint.actionPlan) : null
    );

    if (complaint.aiAnalysis) {
      insertAIStmt.run(
        complaint.id,
        complaint.aiAnalysis.confidence,
        complaint.aiAnalysis.riskAssessment,
        complaint.aiAnalysis.priorityScore,
        complaint.aiAnalysis.citizenSafetyAdvice,
        complaint.aiAnalysis.suggestedResolution,
        complaint.aiAnalysis.estimatedResolutionDays
      );
    }

    insertVerificationStmt.run(complaint.id, "reporter_token", complaint.reportedAt);

    insertLogStmt.run(
      complaint.id,
      "CREATED",
      `Civic complaint created by ${complaint.reportedBy}.`,
      "system",
      complaint.reportedAt
    );
  });

  try {
    transaction();
    return true;
  } catch (err) {
    console.error("SQLite write error on createComplaint:", err);
    throw err;
  }
}

/**
 * Handle verification (upvoting/downvoting) on a complaint
 */
export function verifyComplaint(complaintId: string, userId: string, type: "upvote" | "downvote"): Complaint | null {
  const insertVerificationStmt = db.prepare(`
    INSERT INTO verification (complaintId, userId, type, createdAt) VALUES (?, ?, ?, ?)
  `);

  const updateVotesStmt = db.prepare(`
    UPDATE complaints
    SET upvotes = upvotes + ?,
        downvotes = downvotes + ?,
        status = ?
    WHERE id = ?
  `);

  const insertLogStmt = db.prepare(`
    INSERT INTO activity_logs (complaintId, action, description, userId, timestamp) VALUES (?, ?, ?, ?, ?)
  `);

  const complaint = getComplaintById(complaintId);
  if (!complaint) return null;

  // Check if user already voted
  const existingVote = db.prepare("SELECT id FROM verification WHERE complaintId = ? AND userId = ?").get(complaintId, userId);
  if (existingVote) {
    throw new Error("You have already verified this complaint.");
  }

  const transaction = db.transaction(() => {
    const timestamp = new Date().toISOString();
    insertVerificationStmt.run(complaintId, userId, type, timestamp);

    let upvoteDiff = 0;
    let downvoteDiff = 0;
    let newStatus = complaint.status;

    if (type === "upvote") {
      upvoteDiff = 1;
      const futureUpvotes = complaint.upvotes + 1;
      if (futureUpvotes >= 3 && complaint.status === "Reported") {
        newStatus = "Verified";
      }
    } else {
      downvoteDiff = 1;
      const futureDownvotes = complaint.downvotes + 1;
      if (futureDownvotes >= 5 && complaint.status !== "Closed") {
        newStatus = "Closed";
      }
    }

    updateVotesStmt.run(upvoteDiff, downvoteDiff, newStatus, complaintId);

    insertLogStmt.run(
      complaintId,
      type === "upvote" ? "VERIFIED_UPVOTE" : "VERIFIED_DOWNVOTE",
      `Citizen verified issue via ${type} (User: ${userId}).`,
      userId,
      timestamp
    );
  });

  transaction();
  return getComplaintById(complaintId);
}

/**
 * Update the status of a complaint
 */
export function updateComplaintStatus(id: string, status: string): Complaint | null {
  const updateStmt = db.prepare(`
    UPDATE complaints
    SET status = ?
    WHERE id = ?
  `);

  const insertLogStmt = db.prepare(`
    INSERT INTO activity_logs (complaintId, action, description, userId, timestamp) VALUES (?, ?, ?, ?, ?)
  `);

  const complaint = getComplaintById(id);
  if (!complaint) return null;

  const transaction = db.transaction(() => {
    updateStmt.run(status, id);
    insertLogStmt.run(
      id,
      "STATUS_CHANGED",
      `Status updated from '${complaint.status}' to '${status}'.`,
      "admin",
      new Date().toISOString()
    );
  });

  transaction();
  return getComplaintById(id);
}

/**
 * Update the official AI summary & step-by-step action plan
 */
export function updateComplaintSummary(id: string, summary: string, actionPlan: string[]): Complaint | null {
  const updateStmt = db.prepare(`
    UPDATE complaints
    SET summary = ?,
        actionPlan = ?
    WHERE id = ?
  `);

  const insertLogStmt = db.prepare(`
    INSERT INTO activity_logs (complaintId, action, description, userId, timestamp) VALUES (?, ?, ?, ?, ?)
  `);

  const complaint = getComplaintById(id);
  if (!complaint) return null;

  const transaction = db.transaction(() => {
    updateStmt.run(summary, JSON.stringify(actionPlan), id);
    insertLogStmt.run(
      id,
      "SUMMARY_GENERATED",
      `AI official notice & step-by-step repair action plan generated.`,
      "ai_engine",
      new Date().toISOString()
    );
  });

  transaction();
  return getComplaintById(id);
}

/**
 * Delete a complaint completely
 */
export function deleteComplaint(id: string): boolean {
  const deleteStmt = db.prepare("DELETE FROM complaints WHERE id = ?");
  const result = deleteStmt.run(id);
  return result.changes > 0;
}

/**
 * Get comments for a specific complaint
 */
export function getComments(complaintId: string): Comment[] {
  return db.prepare("SELECT * FROM comments WHERE complaintId = ? ORDER BY createdAt ASC").all(complaintId) as Comment[];
}

/**
 * Create a new comment
 */
export function createComment(comment: Comment): Comment {
  const insertStmt = db.prepare(`
    INSERT INTO comments (id, complaintId, author, text, createdAt) VALUES (?, ?, ?, ?, ?)
  `);

  const insertLogStmt = db.prepare(`
    INSERT INTO activity_logs (complaintId, action, description, userId, timestamp) VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertStmt.run(comment.id, comment.complaintId, comment.author, comment.text, comment.createdAt);
    insertLogStmt.run(
      comment.complaintId,
      "COMMENT_ADDED",
      `New feedback comment submitted by ${comment.author}.`,
      "citizen",
      comment.createdAt
    );
  });

  transaction();
  return comment;
}

/**
 * Retrieve database activity logs (useful for analytics or audit logging)
 */
export function getActivityLogs(limit: number = 50): ActivityLog[] {
  return db.prepare("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?").all(limit) as ActivityLog[];
}
