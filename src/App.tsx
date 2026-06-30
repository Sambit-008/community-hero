import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  MapPin,
  CheckCircle,
  Clock,
  ShieldAlert,
  Send,
  Upload,
  Plus,
  BarChart3,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Info,
  Calendar,
  Building2,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  ArrowLeft,
  Activity,
  User,
  Heart,
  Briefcase,
  Trash2,
  Copy,
  Check
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { Complaint, Comment, DashboardStats, Location, AIAnalysis } from "./types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function App() {
  // --- STATE ---
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeTab, setActiveTab] = useState<"map" | "analytics" | "assistant">("map");

  // Filter States
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [sevFilter, setSevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [verifiedOnlyFilter, setVerifiedOnlyFilter] = useState(false);

  // Map & Interactive References
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Reporting Form States
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("Other");
  const [formSeverity, setFormSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [formDept, setFormDept] = useState("Public Works");
  const [formAddress, setFormAddress] = useState("");
  const [formLat, setFormLat] = useState(22.9734);
  const [formLng, setFormLng] = useState(78.6569);
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formReporter, setFormReporter] = useState("");

  // Loading States
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // AI Assistant Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string; isTyping?: boolean }>>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome, Operations Officer. I am your Agentic Municipal Operations Assistant. I analyze our active SQLite database, detect hotspots, and generate real-time recommendations. Ask me anything, or generate a briefing below.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI Insights and Dashboard Interactive States
  const [aiInsights, setAiInsights] = useState<{
    summary: string;
    patterns: string[];
    recommendations: string[];
  } | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [scrolledQuickStats, setScrolledQuickStats] = useState(false);
  const [scrolledAnalyticsKPIs, setScrolledAnalyticsKPIs] = useState(false);

  // New Comment Fields
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");

  // User Local Token (simulate authentic local user)
  const [userToken] = useState(() => {
    let token = localStorage.getItem("community_hero_token");
    if (!token) {
      token = "user_" + Math.random().toString(36).substring(2, 11);
      localStorage.setItem("community_hero_token", token);
    }
    return token;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- FILTERS & SEARCH PROCESSING ---
  const filteredComplaints = complaints.filter(c => {
    const matchesSearch =
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.location.address.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = catFilter === "All" || c.category === catFilter;
    const matchesSeverity = sevFilter === "All" || c.severity === sevFilter;
    const matchesStatus = statusFilter === "All" || c.status === statusFilter;
    const matchesDepartment = deptFilter === "All" || c.department === deptFilter;
    const matchesVerifiedOnly = !verifiedOnlyFilter || (c.status === "Verified" || c.status === "In Progress" || c.status === "Resolved" || c.status === "Closed" || c.upvotes >= 3);
    
    const matchesDate = (() => {
      if (dateFilter === "All") return true;
      try {
        const reportedDate = new Date(c.reportedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - reportedDate.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (dateFilter === "Today") {
          return diffDays <= 1;
        }
        if (dateFilter === "Last 7 Days") {
          return diffDays <= 7;
        }
        if (dateFilter === "Last 30 Days") {
          return diffDays <= 30;
        }
      } catch (err) {
        console.error("Error filtering date:", err);
      }
      return true;
    })();

    return matchesSearch && matchesCategory && matchesSeverity && matchesStatus && matchesDepartment && matchesVerifiedOnly && matchesDate;
  });

  // --- API CALLS ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const resComp = await fetch("/api/complaints");
      const dataComp = await resComp.json();
      setComplaints(dataComp);

      const resStats = await fetch("/api/analytics");
      const dataStats = await resStats.json();
      setStats(dataStats);
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    try {
      setAiInsightsLoading(true);
      const res = await fetch("/api/analytics/ai-insights");
      const data = await res.json();
      setAiInsights(data);
    } catch (e) {
      console.error("Error fetching AI insights:", e);
    } finally {
      setAiInsightsLoading(false);
    }
  };

  // Automatically fetch AI Insights when switching to the analytics tab
  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAIInsights();
    }
  }, [activeTab]);

  const fetchComments = async (complaintId: string) => {
    try {
      setCommentLoading(true);
      const res = await fetch(`/api/comments/${complaintId}`);
      const data = await res.json();
      setComments(data);
    } catch (e) {
      console.error("Error fetching comments:", e);
    } finally {
      setCommentLoading(false);
    }
  };

  // Run on Mount
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch comments when selected complaint changes
  useEffect(() => {
    if (selectedId) {
      fetchComments(selectedId);
    } else {
      setComments([]);
    }
  }, [selectedId]);

  // Scroll Chat to Bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // --- Leaflet Helpers ---
  const getStatusColorClasses = (status: string) => {
    const stat = status.toLowerCase();
    if (stat === "reported" || stat === "analyzed" || stat === "pending") {
      return { bg: "bg-rose-500", pulse: "bg-rose-500", text: "text-rose-500" };
    } else if (stat === "verified") {
      return { bg: "bg-amber-500", pulse: "bg-amber-500", text: "text-amber-500" };
    } else if (stat === "in progress") {
      return { bg: "bg-blue-500", pulse: "bg-blue-500", text: "text-blue-500" };
    } else if (stat === "resolved") {
      return { bg: "bg-emerald-500", pulse: "bg-emerald-500", text: "text-emerald-500" };
    } else {
      return { bg: "bg-slate-500", pulse: "bg-slate-500", text: "text-slate-500" };
    }
  };

  const getCategorySvg = (category: string): string => {
    const cat = category.toLowerCase();
    if (cat.includes("road") || cat.includes("pothole")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m9 12-2 5h10l-2-5"/></svg>`;
    } else if (cat.includes("garbage") || cat.includes("dumping") || cat.includes("trash")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x1="10" y1="11" y2="17"/><line x1="14" x1="14" y1="11" y2="17"/></svg>`;
    } else if (cat.includes("water") || cat.includes("leakage") || cat.includes("flood")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>`;
    } else if (cat.includes("streetlight") || cat.includes("light") || cat.includes("lamp")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .4 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`;
    } else if (cat.includes("drain") || cat.includes("drainage") || cat.includes("sewer")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M2 12h20"/><path d="M4 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M6 12v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/><line x1="9" x1="9" y1="16" y2="16"/><line x1="15" x1="15" y1="16" y2="16"/></svg>`;
    } else if (cat.includes("tree") || cat.includes("plant") || cat.includes("foliage") || cat.includes("park")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M12 20V10"/><path d="m17 14-5-5-5 5h10Z"/><path d="m16 9-4-4-4 4h8Z"/></svg>`;
    } else if (cat.includes("electric") || cat.includes("hazard") || cat.includes("wire") || cat.includes("sparks") || cat.includes("power")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    }
  };

  const createPopupHtml = (comp: Complaint) => {
    const formattedDate = comp.reportedAt ? new Date(comp.reportedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'Unknown Date';

    return `
      <div class="p-3 font-sans w-[280px] bg-slate-900 text-white rounded-xl shadow-xl overflow-hidden border border-slate-700">
        ${comp.imageUrl ? `
          <div class="relative h-28 w-full rounded-lg overflow-hidden mb-2.5">
            <img src="${comp.imageUrl}" class="w-full h-full object-cover" />
            <span class="absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-white">
              ${comp.severity}
            </span>
          </div>
        ` : ''}
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
            <span class="font-mono text-[9px] text-slate-400 font-bold">${comp.id}</span>
            <span class="text-[8px] font-semibold px-2 py-0.5 rounded ${
              comp.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400' :
              comp.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' :
              comp.status === 'Verified' ? 'bg-amber-500/20 text-amber-400' :
              comp.status === 'Closed' ? 'bg-slate-500/20 text-slate-400' :
              'bg-rose-500/20 text-rose-400'
            }">
              ${comp.status}
            </span>
          </div>
          <div>
            <h4 class="font-bold text-xs text-white leading-tight">${comp.title}</h4>
            <p class="text-[9px] text-slate-400 mt-1">${comp.category} &bull; ${comp.department}</p>
          </div>
          
          <div class="grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded-lg text-[9px] border border-slate-800">
            <div>
              <p class="text-slate-500 font-semibold uppercase text-[7px]">Priority Score</p>
              <p class="text-indigo-400 font-bold text-xs mt-0.5">${comp.aiAnalysis?.priorityScore || 'N/A'}</p>
            </div>
            <div>
              <p class="text-slate-500 font-semibold uppercase text-[7px]">Verifications</p>
              <p class="text-amber-400 font-bold text-xs mt-0.5">${comp.upvotes} Upvotes</p>
            </div>
          </div>

          ${comp.aiAnalysis?.citizenSafetyAdvice ? `
            <div class="bg-amber-500/10 border border-amber-500/20 p-2 text-amber-200">
              <p class="font-bold text-[7px] uppercase tracking-wider text-amber-400 mb-0.5">⚠️ Safety Advice</p>
              <p class="leading-normal text-[8px]">${comp.aiAnalysis.citizenSafetyAdvice}</p>
            </div>
          ` : ''}

          ${comp.summary || comp.aiAnalysis?.riskAssessment ? `
            <div class="bg-indigo-500/10 border border-indigo-500/20 p-2 text-indigo-200">
              <p class="font-bold text-[7px] uppercase tracking-wider text-indigo-400 mb-0.5">🤖 AI Brief</p>
              <p class="leading-normal text-[8px] line-clamp-3">${comp.summary || comp.aiAnalysis?.riskAssessment}</p>
            </div>
          ` : ''}

          <div class="text-[8px] text-slate-500 pt-1 text-right">
            Reported: ${formattedDate}
          </div>
        </div>
      </div>
    `;
  };

  // --- Leaflet Map Init useEffect ---
  useEffect(() => {
    if (activeTab === "map" && mapContainerRef.current) {
      if (!mapInstanceRef.current) {
        try {
          const map = L.map(mapContainerRef.current, {
            center: [22.9734, 78.6569], // India Central
            zoom: 5,
            zoomControl: true,
          });

          // Elegant dark theme tile layer matching the slate-900 background
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          }).addTo(map);

          mapInstanceRef.current = map;

          // Capture click coordinates and geocode them!
          map.on("click", (e) => {
            const { lat, lng } = e.latlng;
            setFormLat(Number(lat.toFixed(6)));
            setFormLng(Number(lng.toFixed(6)));
            setFormAddress("Resolving location details...");

            // Use Osm Nominatim reverse-geocoder to get nice street names
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.display_name) {
                  // Keep address readable and shorten if too long
                  setFormAddress(data.display_name);
                } else {
                  setFormAddress(`Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                }
              })
              .catch(() => {
                setFormAddress(`Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              });
          });

        } catch (err: any) {
          console.error("Leaflet map initialization failed:", err);
          setMapError("Failed to render the interactive map. Check console log for details.");
        }
      } else {
        // Redraw container boundaries on tab switch
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 50);
      }
    }

    return () => {
      // Cleanup map on unmount/tab switch
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, [activeTab]);

  // --- Map Markers Sync useEffect ---
  useEffect(() => {
    if (activeTab === "map" && mapInstanceRef.current) {
      const map = mapInstanceRef.current;

      if (!markersGroupRef.current) {
        markersGroupRef.current = L.layerGroup().addTo(map);
      }

      const layerGroup = markersGroupRef.current;
      layerGroup.clearLayers();

      // 1. Draw Optional Heatmap Density Layer
      const proximityThreshold = 0.002; // ~200 meters proximity
      const clusters: Array<{ lat: number; lng: number; count: number }> = [];

      filteredComplaints.forEach(c => {
        if (!c.location || typeof c.location.lat !== "number" || typeof c.location.lng !== "number") return;
        
        let foundCluster = false;
        for (const cluster of clusters) {
          const distance = Math.sqrt(
            Math.pow(c.location.lat - cluster.lat, 2) + 
            Math.pow(c.location.lng - cluster.lng, 2)
          );
          if (distance < proximityThreshold) {
            cluster.lat = (cluster.lat * cluster.count + c.location.lat) / (cluster.count + 1);
            cluster.lng = (cluster.lng * cluster.count + c.location.lng) / (cluster.count + 1);
            cluster.count += 1;
            foundCluster = true;
            break;
          }
        }
        if (!foundCluster) {
          clusters.push({ lat: c.location.lat, lng: c.location.lng, count: 1 });
        }
      });

      // Render Rose/Red Density circle halo on the map for overlapping/clustered complaints
      clusters.forEach(cluster => {
        if (cluster.count > 1) {
          L.circle([cluster.lat, cluster.lng], {
            radius: 120 * cluster.count,
            fillColor: "#f43f5e", // rose-500
            fillOpacity: 0.15 + (0.05 * Math.min(cluster.count, 5)),
            stroke: false,
            interactive: false
          }).addTo(layerGroup);
        }
      });

      // 2. Render Complaint Markers
      filteredComplaints.forEach(comp => {
        if (!comp.location || typeof comp.location.lat !== "number" || typeof comp.location.lng !== "number" || isNaN(comp.location.lat) || isNaN(comp.location.lng)) {
          return;
        }

        const colors = getStatusColorClasses(comp.status);
        const svgIcon = getCategorySvg(comp.category);
        const isSelected = comp.id === selectedId;

        const html = `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full ${colors.pulse} opacity-40 animate-ping"></div>
            <div class="w-7 h-7 rounded-full ${colors.bg} text-white flex items-center justify-center border-2 ${
              isSelected ? 'border-indigo-400 ring-4 ring-indigo-500/30 scale-125' : 'border-white'
            } shadow-lg relative z-10 transition-transform duration-150">
              ${svgIcon}
            </div>
          </div>
        `;

        const markerIcon = L.divIcon({
          html: html,
          className: "custom-leaflet-marker",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const popupContent = createPopupHtml(comp);

        const marker = L.marker([comp.location.lat, comp.location.lng], { icon: markerIcon })
          .bindPopup(popupContent, {
            maxWidth: 300,
            className: "leaflet-custom-popup-theme"
          });

        marker.on("click", () => {
          setSelectedId(comp.id);
        });

        marker.addTo(layerGroup);

        if (isSelected) {
          setTimeout(() => {
            marker.openPopup();
            map.setView([comp.location.lat, comp.location.lng], Math.max(map.getZoom(), 14), { animate: true });
          }, 100);
        }
      });
    }
  }, [activeTab, filteredComplaints, selectedId]);

  // --- ACTIONS ---

  // Image Upload & Real-Time Gemini AI Analysis
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file type verification
    if (!file.type.startsWith("image/")) {
      setAiError("Unsupported file format. Please upload an image (JPEG, PNG, WEBP, GIF, etc.).");
      return;
    }

    // Reset warnings and errors
    setAiWarning(null);
    setAiError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setFormImage(base64);
      
      // Trigger AI Classification immediately to help auto-fill form
      setIsAnalyzing(true);
      try {
        const res = await fetch("/api/analyze-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
            userTitle: formTitle,
            userDescription: formDesc
          })
        });
        
        if (!res.ok) throw new Error("AI analysis failed on server request");
        const analysis = await res.json();
        
        // Auto-fill form fields
        if (analysis.title) setFormTitle(analysis.title);
        if (analysis.description) setFormDesc(analysis.description);
        if (analysis.category) setFormCategory(analysis.category);
        if (analysis.severity) setFormSeverity(analysis.severity);
        if (analysis.department) setFormDept(analysis.department);

        // Store analysis result in temporary state to send during submission
        (window as any)._pendingAiAnalysis = analysis.aiAnalysis;

        // Check analysis confidence for warning indicators (blurry/unclear image detection)
        if (analysis.aiAnalysis && typeof analysis.aiAnalysis.confidence === "number") {
          const score = analysis.aiAnalysis.confidence;
          if (score < 0.5) {
            setAiWarning(`Unclear or blurry image warning (AI confidence: ${(score * 100).toFixed(0)}%). The AI is uncertain about the hazard details. Please review and manually verify the auto-filled fields below, or consider uploading a higher resolution photo.`);
          }
        }
      } catch (err) {
        console.error("AI Auto-fill error:", err);
        setAiError("Could not connect to live Gemini. Using localized smart heuristic system to analyze issue.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Complaint Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formDesc || !formAddress) {
      alert("Please fill out Title, Description, and Address.");
      return;
    }

    const payload = {
      title: formTitle,
      description: formDesc,
      category: formCategory,
      severity: formSeverity,
      department: formDept,
      location: {
        lat: formLat,
        lng: formLng,
        address: formAddress
      },
      imageUrl: formImage,
      reportedBy: formReporter || "Anonymous Citizen",
      aiAnalysis: (window as any)._pendingAiAnalysis || null
    };

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Form submission failed");
      const newComp = await res.json();
      
      // Update local state
      setComplaints(prev => [newComp, ...prev]);
      setSelectedId(newComp.id); // Select the newly created complaint immediately
      
      // Clear form states
      setFormTitle("");
      setFormDesc("");
      setFormCategory("Other");
      setFormSeverity("Medium");
      setFormDept("Public Works");
      setFormAddress("");
      setFormImage(null);
      setFormReporter("");
      (window as any)._pendingAiAnalysis = null;
      setAiWarning(null);
      setAiError(null);
      setSubmitSuccess("Civic complaint successfully submitted and saved permanently to SQLite!");

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setSubmitSuccess(null);
      }, 5000);

      // Refresh Analytics stats
      const statsRes = await fetch("/api/analytics");
      const statsData = await statsRes.json();
      setStats(statsData);
      if (activeTab === "analytics" || aiInsights) {
        fetchAIInsights();
      }

    } catch (err) {
      console.error(err);
      alert("Error reporting issue.");
    }
  };

  // Upvote/Downvote Community Verification
  const handleVerify = async (type: "upvote" | "downvote") => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/complaints/${selectedId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          userId: userToken
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "You have already verified this complaint.");
        return;
      }

      const updated = await res.json();
      
      // Update complaints state
      setComplaints(prev => prev.map(c => c.id === selectedId ? updated : c));
      
      // Refresh stats
      const statsRes = await fetch("/api/analytics");
      const statsData = await statsRes.json();
      setStats(statsData);
      if (activeTab === "analytics" || aiInsights) {
        fetchAIInsights();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Comments
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !commentAuthor || !commentText) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintId: selectedId,
          author: commentAuthor,
          text: commentText
        })
      });

      if (!res.ok) throw new Error("Failed to add comment");
      const newComment = await res.json();
      setComments(prev => [...prev, newComment]);
      
      setCommentText("");
    } catch (err) {
      console.error(err);
    }
  };

  // Update Status simulator
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/complaints/${selectedId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      
      setComplaints(prev => prev.map(c => c.id === selectedId ? updated : c));

      // Refresh stats
      const statsRes = await fetch("/api/analytics");
      const statsData = await statsRes.json();
      setStats(statsData);
      if (activeTab === "analytics" || aiInsights) {
        fetchAIInsights();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Generate AI Summary & Action Steps
  const handleGenerateSummary = async () => {
    if (!selectedId) return;
    setIsSummarizing(true);
    try {
      const res = await fetch(`/api/complaints/${selectedId}/summarize`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Summary generation failed");
      const updated = await res.json();
      
      setComplaints(prev => prev.map(c => c.id === selectedId ? updated : c));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Typewriter streaming effect helper
  const streamMessage = (fullContent: string) => {
    const newMessageId = `msg_${Date.now()}`;
    setChatMessages(prev => [
      ...prev,
      {
        id: newMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isTyping: true
      }
    ]);

    let wordIndex = 0;
    const words = fullContent.split(" ");

    const interval = setInterval(() => {
      if (wordIndex < words.length) {
        // Append 2-3 words at a time for highly realistic and snappy typewriter streaming speed
        const nextIndex = Math.min(wordIndex + 3, words.length);
        const nextChunk = words.slice(0, nextIndex).join(" ");
        setChatMessages(prev =>
          prev.map(msg =>
            msg.id === newMessageId
              ? { ...msg, content: nextChunk }
              : msg
          )
        );
        wordIndex = nextIndex;
      } else {
        // Completed
        setChatMessages(prev =>
          prev.map(msg =>
            msg.id === newMessageId
              ? { ...msg, content: fullContent, isTyping: false }
              : msg
          )
        );
        clearInterval(interval);
      }
    }, 30);
  };

  // Upgraded Send Message Engine
  const executeSendMessage = async (textToSend: string, isBriefing = false) => {
    if (!textToSend.trim() || chatLoading) return;

    setChatLoading(true);
    const userMsgId = `user_${Date.now()}`;
    
    // Add user message to history
    setChatMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: textToSend,
        timestamp: new Date().toISOString()
      }
    ]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: textToSend }
          ],
          briefing: isBriefing
        })
      });

      if (!res.ok) throw new Error("Assistant response failed");
      const data = await res.json();
      
      // Trigger typewriter streaming effect
      streamMessage(data.reply);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "Sorry, I lost database connection. Please try running your query again in a brief moment!",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Send Assistant Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput;
    setChatInput("");
    await executeSendMessage(userMsg);
  };

  // Clear chat conversation
  const handleClearChat = () => {
    setChatMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Welcome, Operations Officer. I am your Agentic Municipal Operations Assistant. I analyze our active SQLite database, detect hotspots, and generate real-time recommendations. Ask me anything, or generate a briefing below.",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  // Copy response helper
  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Select Map Pin Location (Seattle preset locations helper)
  const setPresetLocation = (address: string, lat: number, lng: number) => {
    setFormAddress(address);
    setFormLat(lat);
    setFormLng(lng);
  };

  const selectedComplaint = complaints.find(c => c.id === selectedId);

  // Severity styling helper
  const getSeverityBadge = (sev: string) => {
    const classes: Record<string, string> = {
      Low: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/40",
      Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40",
      High: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
      Critical: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40 animate-pulse"
    };
    return classes[sev] || "bg-gray-100 text-gray-800";
  };

  // Status styling helper
  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      Reported: "bg-gray-100 text-gray-700 border-gray-200",
      Analyzed: "bg-indigo-100 text-indigo-700 border-indigo-200",
      Verified: "bg-teal-100 text-teal-700 border-teal-200",
      "In Progress": "bg-yellow-100 text-yellow-700 border-yellow-200",
      Resolved: "bg-green-100 text-green-700 border-green-200",
      Closed: "bg-purple-100 text-purple-700 border-purple-200"
    };
    return classes[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col pb-6">
      
      {/* HEADER SECTION */}
      <header id="header_panel" className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Community Hero
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 tracking-normal font-mono">
                  AI Hyperlocal MVP
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Empowering neighborhoods with instant AI-driven civic hazard identification and tracking.
              </p>
            </div>
          </div>

          {/* Quick Stats Header Row */}
          {stats && (
            <div className="relative max-w-full">
              <div 
                onScroll={(e) => {
                  if (e.currentTarget.scrollLeft > 15) {
                    setScrolledQuickStats(true);
                  } else {
                    setScrolledQuickStats(false);
                  }
                }}
                className="flex flex-nowrap md:flex-wrap items-center gap-2 text-xs max-w-full pb-1.5 md:pb-0 scrollbar-none scroll-smooth [overscroll-behavior-x:contain] touch-scroll-x"
              >
                <div className="flex items-center justify-center md:justify-start bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 font-medium min-w-[130px] md:min-w-0 h-9 md:h-auto whitespace-nowrap shrink-0">
                  <span className="w-2 h-2 rounded-full bg-slate-400 mr-2 shrink-0"></span>
                  <span className="shrink-0">Total Reports:</span>
                  <span className="font-bold ml-1 text-slate-800 shrink-0">{stats.total}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-1.5 font-medium text-yellow-800 min-w-[130px] md:min-w-0 h-9 md:h-auto whitespace-nowrap shrink-0">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2 animate-pulse shrink-0"></span>
                  <span className="shrink-0">In Progress:</span>
                  <span className="font-bold ml-1 shrink-0">{stats.inProgress}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 font-medium text-green-800 min-w-[130px] md:min-w-0 h-9 md:h-auto whitespace-nowrap shrink-0">
                  <span className="w-2 h-2 rounded-full bg-green-400 mr-2 shrink-0"></span>
                  <span className="shrink-0">Resolved:</span>
                  <span className="font-bold ml-1 shrink-0">{stats.resolved}</span>
                </div>
                <button
                  onClick={fetchData}
                  title="Refresh stats"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all shrink-0 h-9 md:h-auto flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile visual cue: right gradient edge & Swipe indicator */}
              <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white via-white/80 to-transparent z-10 md:hidden flex items-center justify-end pr-1 transition-opacity duration-300 ${scrolledQuickStats ? 'opacity-0' : 'opacity-100'}`}>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800/90 text-white px-2 py-1 rounded-full shadow-sm">
                  Swipe →
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* CORE WORKSPACE */}
      <main className="max-w-7xl w-full mx-auto px-4 flex-1 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: VISUAL TOOLS, MAP, AND ANALYTICS (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* Work Mode Toggle Tabs */}
          <div className="bg-white border border-slate-200 p-1.5 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex space-x-1 w-full">
              <button
                id="tab_map"
                onClick={() => setActiveTab("map")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "map"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <MapPin className="w-4 h-4" />
                Hyperlocal Map Grid
              </button>
              <button
                id="tab_analytics"
                onClick={() => setActiveTab("analytics")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "analytics"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics Dashboard
              </button>
              <button
                id="tab_assistant"
                onClick={() => setActiveTab("assistant")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "assistant"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Assistant Chat
              </button>
            </div>
          </div>

          {/* TAB CONTENTS CONTAINER */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[520px]">
            
            {/* 1. MAP VIEW */}
            {activeTab === "map" && (
              <div id="map_panel" className="relative flex-1 flex flex-col bg-slate-900 overflow-hidden min-h-[480px]">
                {/* Real Interactive Map Container */}
                <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

                {mapError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 text-white p-6 z-20 text-center">
                    <AlertTriangle className="w-10 h-10 text-rose-500 mb-2 animate-bounce" />
                    <h3 className="text-sm font-bold">Interactive Map Offline</h3>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">{mapError}</p>
                  </div>
                )}

                {filteredComplaints.length === 0 && !mapError && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-6 rounded-2xl text-center shadow-2xl z-[1000] max-w-sm w-[90%] pointer-events-auto">
                    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-indigo-400 mx-auto mb-3">
                      <Search className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">No Map Results Found</h3>
                    <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
                      No reported hazards match your active search or selected filters. Try clearing your search parameters to find existing complaints.
                    </p>
                    <button
                      onClick={() => {
                        setSearch("");
                        setCatFilter("All");
                        setSevFilter("All");
                        setStatusFilter("All");
                        setDeptFilter("All");
                        setDateFilter("All");
                        setVerifiedOnlyFilter(false);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-4 py-2 rounded-xl transition shadow-sm cursor-pointer active:scale-95"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
                {/* SVG Vector Interactive Neighborhood Map */}
                <div className="absolute inset-0 select-none hidden">
                  <svg viewBox="0 0 800 500" className="w-full h-full opacity-90 transition-transform">
                    {/* Background Grids & Water (Puget Sound) */}
                    <rect width="800" height="500" fill="#0f172a" />
                    {/* Water Body (left hand side) */}
                    <path d="M 0 0 L 150 0 C 130 180, 180 320, 100 500 L 0 500 Z" fill="#1e293b" opacity="0.6" />
                    <path d="M 0 0 L 140 0 C 120 180, 170 320, 90 500 L 0 500 Z" fill="#1d4ed8" opacity="0.15" fillRule="evenodd" />
                    
                    {/* Parks & Green zones */}
                    <rect x="110" y="20" width="80" height="110" rx="6" fill="#065f46" opacity="0.25" />
                    <text x="150" y="80" fill="#059669" fontSize="10" fontWeight="bold" textAnchor="middle" opacity="0.8">
                      Waterfront Park
                    </text>

                    <rect x="580" y="320" width="120" height="150" rx="8" fill="#065f46" opacity="0.2" />
                    <text x="640" y="400" fill="#059669" fontSize="10" fontWeight="bold" textAnchor="middle" opacity="0.8">
                      International Park
                    </text>

                    {/* Urban City Blocks */}
                    <g fill="#1e293b" opacity="0.5" stroke="#334155" strokeWidth="1">
                      <rect x="220" y="40" width="100" height="70" rx="4" />
                      <rect x="340" y="40" width="100" height="70" rx="4" />
                      <rect x="460" y="40" width="100" height="70" rx="4" />

                      <rect x="220" y="140" width="100" height="100" rx="4" />
                      <rect x="340" y="140" width="100" height="100" rx="4" />
                      <rect x="460" y="140" width="100" height="100" rx="4" />

                      <rect x="220" y="270" width="100" height="80" rx="4" />
                      <rect x="340" y="270" width="100" height="80" rx="4" />
                      <rect x="460" y="270" width="100" height="80" rx="4" />

                      <rect x="220" y="380" width="100" height="80" rx="4" />
                      <rect x="340" y="380" width="100" height="80" rx="4" />
                      <rect x="460" y="380" width="100" height="80" rx="4" />
                    </g>

                    {/* Streets Map Network Lines */}
                    <g stroke="#475569" strokeWidth="16" strokeLinecap="round" opacity="0.4">
                      {/* Broad St */}
                      <line x1="120" y1="60" x2="750" y2="60" />
                      {/* Pine St */}
                      <line x1="120" y1="180" x2="750" y2="180" />
                      {/* E Pine St / Capitol Hill connection */}
                      <line x1="120" y1="300" x2="750" y2="300" />
                      {/* S Jackson St */}
                      <line x1="120" y1="420" x2="750" y2="420" />

                      {/* 2nd Ave (Vertical) */}
                      <line x1="200" y1="20" x2="200" y2="480" />
                      {/* 4th Ave */}
                      <line x1="330" y1="20" x2="330" y2="480" />
                      {/* 12th Ave */}
                      <line x1="570" y1="20" x2="570" y2="480" />
                    </g>

                    {/* Street Labels */}
                    <g fill="#94a3b8" fontSize="9" fontWeight="medium" opacity="0.7">
                      <text x="212" y="30" textAnchor="start">2nd Ave</text>
                      <text x="342" y="30" textAnchor="start">4th Ave</text>
                      <text x="582" y="30" textAnchor="start">12th Ave</text>

                      <text x="730" y="52" textAnchor="end">Broad St</text>
                      <text x="730" y="172" textAnchor="end">Pine St</text>
                      <text x="730" y="292" textAnchor="end">E Pine St</text>
                      <text x="730" y="412" textAnchor="end">S Jackson St</text>
                    </g>
                  </svg>
                </div>

                {/* Live Floating Interactive Map Hotspots */}
                <div className="absolute inset-0 hidden">
                  {complaints.map(comp => {
                    // Translate Lat Long to local SVG map coordinates
                    // Latitude range roughly Seattle central: 47.5985 to 47.6210
                    // Longitude range: -122.3500 to -122.3200
                    const mapY = 500 - ((comp.location.lat - 47.595) / (47.623 - 47.595)) * 500;
                    const mapX = ((comp.location.lng - (-122.353)) / (-122.318 - (-122.353))) * 800;

                    const isSelected = selectedId === comp.id;
                    const isCritical = comp.severity === "Critical";

                    return (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedId(comp.id)}
                        style={{
                          left: `${Math.max(10, Math.min(95, (mapX / 800) * 100))}%`,
                          top: `${Math.max(10, Math.min(90, (mapY / 500) * 100))}%`
                        }}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-10 focus:outline-none"
                      >
                        {/* Pulse Ring */}
                        <span className={`absolute inline-flex h-10 w-10 rounded-full opacity-60 animate-ping -left-3 -top-3 ${
                          isCritical
                            ? "bg-rose-500"
                            : comp.severity === "High"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`} />

                        {/* Solid Pin Marker */}
                        <div className={`w-4 h-4 rounded-full border-2 shadow-md transition-all scale-100 group-hover:scale-125 ${
                          isSelected ? "w-6 h-6 border-white bg-indigo-500 scale-125 ring-4 ring-indigo-500/30" : "border-slate-800"
                        } ${
                          comp.severity === "Critical"
                            ? "bg-rose-500"
                            : comp.severity === "High"
                            ? "bg-amber-500"
                            : "bg-blue-400"
                        }`} />

                        {/* Hover Popup Address Label */}
                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] py-1.5 px-2.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-30 flex items-center gap-1.5 font-medium">
                          <AlertTriangle className={`w-3.5 h-3.5 ${
                            comp.severity === "Critical" ? "text-rose-400" : "text-amber-400"
                          }`} />
                          <div>
                            <p className="font-bold">{comp.category}</p>
                            <p className="text-slate-400 text-[9px]">{comp.location.address.split(",")[0]}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Map Legend Overlay */}
                <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl text-[10px] text-slate-300 space-y-1.5 shadow-2xl" style={{ zIndex: 500 }}>
                  <p className="font-semibold text-white tracking-wider uppercase text-[8px] opacity-75">Hazard Legend</p>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
                    <span>Critical Emergency (Pothole/Flooding)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                    <span>High Priority (Streetlight/Trash)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 block" />
                    <span>Medium/Low Level Issues</span>
                  </div>
                  <p className="text-[8px] text-slate-400 italic pt-1">💡 Click any glowing hotspot to inspect details</p>
                </div>

                {/* Presets Auto-Coordinate Picker (For MVP testing convenience) */}
                <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl text-[10px] text-slate-300 max-w-[200px] shadow-2xl space-y-1.5" style={{ zIndex: 500 }}>
                  <p className="font-semibold text-white uppercase text-[8px] opacity-75">Click Map to set Location or Use Presets:</p>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setPresetLocation("S.V. Road, near Bandra West Station, Mumbai", 19.0544, 72.8402)}
                      className="text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 px-2 py-1 rounded transition text-[9px] truncate"
                    >
                      📍 Bandra West, Mumbai (Pothole)
                    </button>
                    <button
                      onClick={() => setPresetLocation("Block K, Lajpat Nagar II, New Delhi", 28.5672, 77.2435)}
                      className="text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 px-2 py-1 rounded transition text-[9px] truncate"
                    >
                      📍 Lajpat Nagar, Delhi (Garbage)
                    </button>
                    <button
                      onClick={() => setPresetLocation("100 Feet Road, Indiranagar, Bengaluru", 12.9716, 77.6412)}
                      className="text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 px-2 py-1 rounded transition text-[9px] truncate"
                    >
                      📍 Indiranagar, Bengaluru (Water Leak)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ANALYTICS DASHBOARD VIEW */}
            {activeTab === "analytics" && stats && (
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50">
                {stats.total === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 px-4 text-center h-full">
                    <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 shadow-sm animate-pulse">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">No Analytics Available Yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1.5 mb-6 leading-relaxed">
                      There are currently no reports filed in the database. Once community members file their first hyperlocal report, analytics dashboards, heatmaps, and AI-driven insights will automatically populate here.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedId(null);
                        setActiveTab("map");
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Report a Local Hazard
                    </button>
                  </div>
                ) : (
                  <>
                
                {/* Header with Title */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Civic Analytics Dashboard
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Real-time telemetry and database insights from community reports.
                    </p>
                  </div>
                </div>

                {/* KPI CARDS (Total, Pending, In Progress, Resolved, High Priority) */}
                <div className="relative max-w-full">
                  <div 
                    className="flex flex-nowrap overflow-x-auto max-w-full gap-4 pb-4"
                  >
                    {/* Total */}
                    <div className="bg-white border border-slate-300/80 p-5 rounded-2xl shadow-md hover:shadow-lg hover:border-indigo-400 transition duration-300 flex flex-col items-center justify-center text-center group relative overflow-hidden flex-none shrink-0 w-[170px] md:w-[150px]">
                      <div className="p-2.5 bg-indigo-50 rounded-full text-indigo-500 mb-2 shrink-0">
                        <BarChart3 className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">Total Reports</p>
                      <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight text-center">{stats.total}</p>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium text-center">Accumulated database entries</p>
                    </div>

                    {/* Pending */}
                    <div className="bg-white border border-slate-300/80 p-5 rounded-2xl shadow-md hover:shadow-lg hover:border-blue-400 transition duration-300 flex flex-col items-center justify-center text-center group relative overflow-hidden flex-none shrink-0 w-[170px] md:w-[150px]">
                      <div className="p-2.5 bg-blue-50 rounded-full text-blue-500 mb-2 shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">Pending Issues</p>
                      <p className="text-3xl font-black text-blue-600 mt-1 tracking-tight text-center">{stats.pending}</p>
                      <p className="text-[10px] text-blue-500 mt-2 font-semibold bg-blue-50 px-1.5 py-0.5 rounded text-center">
                        Awaiting verification
                      </p>
                    </div>

                    {/* In Progress */}
                    <div className="bg-white border border-slate-300/80 p-5 rounded-2xl shadow-md hover:shadow-lg hover:border-amber-400 transition duration-300 flex flex-col items-center justify-center text-center group relative overflow-hidden flex-none shrink-0 w-[170px] md:w-[150px]">
                      <div className="p-2.5 bg-amber-50 rounded-full text-amber-500 mb-2 shrink-0">
                        <RefreshCw className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">In Progress</p>
                      <p className="text-3xl font-black text-amber-600 mt-1 tracking-tight text-center">{stats.inProgress}</p>
                      <p className="text-[10px] text-amber-600 mt-2 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-center">
                        Dispatch crew deployed
                      </p>
                    </div>

                    {/* Resolved */}
                    <div className="bg-white border border-slate-300/80 p-5 rounded-2xl shadow-md hover:shadow-lg hover:border-green-400 transition duration-300 flex flex-col items-center justify-center text-center group relative overflow-hidden flex-none shrink-0 w-[170px] md:w-[150px]">
                      <div className="p-2.5 bg-green-50 rounded-full text-green-500 mb-2 shrink-0">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">Resolved Issues</p>
                      <p className="text-3xl font-black text-green-600 mt-1 tracking-tight text-center">{stats.resolved}</p>
                      <p className="text-[10px] text-green-600 mt-2 font-semibold bg-green-50 px-1.5 py-0.5 rounded text-center">
                        Remediations completed
                      </p>
                    </div>

                    {/* High Priority */}
                    <div className="bg-white border border-slate-300/80 p-5 rounded-2xl shadow-md hover:shadow-lg hover:border-rose-400 transition duration-300 flex flex-col items-center justify-center text-center group relative overflow-hidden flex-none shrink-0 w-[170px] md:w-[150px]">
                      <div className="p-2.5 bg-rose-50 rounded-full text-rose-500 mb-2 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">High Priority</p>
                      <p className="text-3xl font-black text-rose-600 mt-1 tracking-tight text-center">{stats.highPriority}</p>
                      <p className="text-[10px] text-rose-600 mt-2 font-semibold bg-rose-50 px-1.5 py-0.5 rounded text-center">
                        Urgent safety hazards
                      </p>
                    </div>
                  </div>
                </div>

                {/* CORE CHARTS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Category Breakdown (Donut-style Horizontal progress bars with interactivity) */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-6 hover:shadow-md transition duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-slate-400" />
                        Complaints by Category
                      </h3>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">Interactive View</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Distribution of civic reports. Hover to review relative percentage weights across categories.
                    </p>
                    <div className="space-y-4">
                      {Object.entries(stats.byCategory).map(([category, count]) => {
                        const pct = stats.total > 0 ? ((count as number) / stats.total) * 100 : 0;
                        const isHovered = hoveredCategory === category;
                        return (
                          <div
                            key={category}
                            onMouseEnter={() => setHoveredCategory(category)}
                            onMouseLeave={() => setHoveredCategory(null)}
                            className={`space-y-1 p-2 rounded-xl border transition-all duration-200 ${
                              isHovered ? "bg-indigo-50/50 border-indigo-200 shadow-sm translate-x-1" : "border-transparent"
                            }`}
                          >
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-700 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isHovered ? "bg-indigo-600 animate-pulse" : "bg-slate-300"}`} />
                                {category}
                              </span>
                              <span className="text-slate-800 font-bold font-mono">
                                {count} <span className="text-[10px] text-slate-400 font-normal">({Math.round(pct)}%)</span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden relative">
                              <div
                                style={{ width: `${pct}%` }}
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isHovered ? "bg-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.5)]" : "bg-indigo-500"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Severity Breakdown */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-6 hover:shadow-md transition duration-300 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-slate-400" />
                          Severity Distribution
                        </h3>
                        <span className="text-[10px] text-slate-400 font-semibold font-mono">Dispatch Priorities</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                        Defects evaluated by public safety impact. Immediate response protocols target Critical and High ratings.
                      </p>
                      
                      <div className="space-y-4 pt-1">
                        {["Critical", "High", "Medium", "Low"].map(sev => {
                          const count = stats.bySeverity[sev] || 0;
                          const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                          const colors: Record<string, { bar: string, text: string, bg: string, desc: string }> = {
                            Critical: { 
                              bar: "bg-rose-500", 
                              text: "text-rose-600", 
                              bg: "bg-rose-50",
                              desc: "Immediate emergency remediation required. Threat to life/property."
                            },
                            High: { 
                              bar: "bg-amber-500", 
                              text: "text-amber-600", 
                              bg: "bg-amber-50",
                              desc: "Severe public hazard. Standard dispatch remediation timeline: 1-2 days."
                            },
                            Medium: { 
                              bar: "bg-blue-500", 
                              text: "text-blue-600", 
                              bg: "bg-blue-50",
                              desc: "Moderate disturbance. Scheduled repair and maintenance within 5 days."
                            },
                            Low: { 
                              bar: "bg-green-500", 
                              text: "text-green-600", 
                              bg: "bg-green-50",
                              desc: "Minor physical cosmetic defect. Cordoned/logged for routine works."
                            }
                          };
                          const currentStyle = colors[sev] || { bar: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", desc: "No protocol defined." };
                          const isHovered = hoveredDept === sev; // re-use states

                          return (
                            <div 
                              key={sev} 
                              onMouseEnter={() => setHoveredDept(sev)}
                              onMouseLeave={() => setHoveredDept(null)}
                              className={`flex flex-col gap-1.5 p-2 rounded-xl transition duration-200 ${
                                isHovered ? `${currentStyle.bg} border border-slate-200 shadow-sm` : "border border-transparent"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${currentStyle.bg} ${currentStyle.text}`}>
                                  {sev}
                                </span>
                                <span className="font-mono text-slate-800 font-bold">
                                  {count} <span className="text-[10px] text-slate-400 font-normal">({Math.round(pct)}%)</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                  <div
                                    style={{ width: `${pct}%` }}
                                    className={`h-full rounded-full transition-all duration-500 ${currentStyle.bar}`}
                                  />
                                </div>
                              </div>
                              {isHovered && (
                                <p className="text-[10px] text-slate-500 leading-relaxed font-medium mt-1 transition-all">
                                  💡 <span className="font-semibold text-slate-600">Protocol:</span> {currentStyle.desc}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Responsive Interactive SVG Monthly Trends Line-Area Chart */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-12 hover:shadow-md transition duration-300">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Monthly Reporting Trends (Civic Logging Activity)
                      </h3>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full font-mono">
                        Interactive SVG Area Chart
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                      A visual timeline mapping the influx of citizen reports. Hover over points to examine precise logging numbers.
                    </p>

                    {/* SVG Line-Area Chart Implementation */}
                    {(() => {
                      const trends = stats.monthlyTrends || [];
                      if (trends.length === 0) return <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No trend data available</div>;

                      const width = 1000;
                      const height = 200;
                      const paddingLeft = 40;
                      const paddingRight = 40;
                      const paddingTop = 20;
                      const paddingBottom = 30;

                      const chartWidth = width - paddingLeft - paddingRight;
                      const chartHeight = height - paddingTop - paddingBottom;

                      const maxVal = Math.max(...trends.map(t => t.count), 5);
                      const xStep = chartWidth / (trends.length - 1 || 1);

                      const points = trends.map((t, i) => {
                        const x = paddingLeft + i * xStep;
                        const y = paddingTop + chartHeight - (t.count / maxVal) * chartHeight;
                        return { x, y, month: t.month, count: t.count };
                      });

                      // Construct svg path
                      const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                      const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

                      return (
                        <div className="relative">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                            <defs>
                              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                              const y = paddingTop + ratio * chartHeight;
                              const val = Math.round(maxVal * (1 - ratio));
                              return (
                                <g key={idx}>
                                  <line 
                                    x1={paddingLeft} 
                                    y1={y} 
                                    x2={width - paddingRight} 
                                    y2={y} 
                                    stroke="#e2e8f0" 
                                    strokeWidth="1" 
                                    strokeDasharray="4,4" 
                                  />
                                  <text 
                                    x={paddingLeft - 10} 
                                    y={y + 4} 
                                    className="text-[10px] fill-slate-400 font-mono font-bold" 
                                    textAnchor="end"
                                  >
                                    {val}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Area Fill */}
                            <path d={areaPath} fill="url(#chartGradient)" />

                            {/* Line Stroke */}
                            <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Interactive Hover Vertical Guidelines */}
                            {hoveredTrendIndex !== null && points[hoveredTrendIndex] && (
                              <line
                                x1={points[hoveredTrendIndex].x}
                                y1={paddingTop}
                                x2={points[hoveredTrendIndex].x}
                                y2={paddingTop + chartHeight}
                                stroke="#818cf8"
                                strokeWidth="1.5"
                                strokeDasharray="3,3"
                              />
                            )}

                            {/* Data Point Circles */}
                            {points.map((p, idx) => {
                              const isHovered = hoveredTrendIndex === idx;
                              return (
                                <g key={idx}>
                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={isHovered ? 8 : 5}
                                    className={`transition-all duration-200 cursor-pointer ${
                                      isHovered ? "fill-indigo-600 stroke-white stroke-[3px]" : "fill-white stroke-indigo-500 stroke-[2.5px]"
                                    }`}
                                    onMouseEnter={() => setHoveredTrendIndex(idx)}
                                    onMouseLeave={() => setHoveredTrendIndex(null)}
                                  />
                                  {/* X Axis Labels */}
                                  <text
                                    x={p.x}
                                    y={height - 5}
                                    className={`text-[10px] font-bold transition-all text-center ${
                                      isHovered ? "fill-indigo-600 font-black scale-105" : "fill-slate-500"
                                    }`}
                                    textAnchor="middle"
                                  >
                                    {p.month}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>

                          {/* Dynamic Tooltip */}
                          <div className="absolute top-0 right-2 flex flex-col items-end pointer-events-none">
                            {hoveredTrendIndex !== null && points[hoveredTrendIndex] ? (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1.5 animate-fadeIn min-w-[150px]">
                                <div className="flex justify-between items-center gap-3">
                                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">{points[hoveredTrendIndex].month} Statistics</span>
                                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                                </div>
                                <div className="flex justify-between items-baseline gap-2 mt-1">
                                  <span className="text-[10px] text-slate-300">Logged Reports:</span>
                                  <span className="text-sm font-black text-indigo-300 font-mono">{points[hoveredTrendIndex].count}</span>
                                </div>
                                <div className="text-[9px] text-slate-400 flex items-center gap-1 border-t border-slate-800 pt-1.5 mt-1.5">
                                  <Sparkles className="w-3 h-3 text-indigo-400" />
                                  <span>Dynamic SQLite sync active</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 shadow-sm">
                                <Info className="w-3 h-3 text-slate-400" />
                                Hover nodes to audit monthly values
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Department Workload Status */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-7 hover:shadow-md transition duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        Departmental Workload & Queue Size
                      </h3>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">Agency Queue</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Allocation of reports to specialized public service agencies. Heavy loading indicates potential response bottlenecks.
                    </p>
                    
                    <div className="space-y-4">
                      {Object.entries(stats.byDepartment).length === 0 ? (
                        <div className="text-slate-400 text-xs py-4 text-center">No active department allocations found.</div>
                      ) : (
                        Object.entries(stats.byDepartment).map(([dept, rawCount]) => {
                          const count = rawCount as number;
                          const deptValues = Object.values(stats.byDepartment) as number[];
                          const maxCount = Math.max(...deptValues, 1);
                          const loadPct = (count / maxCount) * 100;
                          const burdenLevel = count >= 4 ? "Critical Load" : count >= 2 ? "Moderate Load" : "Optimal Load";
                          const burdenColor = count >= 4 ? "text-rose-600 bg-rose-50" : count >= 2 ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50";
                          
                          return (
                            <div key={dept} className="space-y-1.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center text-xs font-semibold">
                                <span className="text-slate-700 flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  {dept}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${burdenColor}`}>
                                    {burdenLevel}
                                  </span>
                                  <span className="font-mono text-slate-800 font-bold">{count} active</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  style={{ width: `${loadPct}%` }}
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    count >= 4 ? "bg-rose-500" : count >= 2 ? "bg-amber-400" : "bg-green-500"
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Resolution Rate Circular Gauge Card */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-5 hover:shadow-md transition duration-300 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Resolution Efficiency
                      </h3>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        The ratio of resolved or closed citizen complaints against incoming logs.
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center py-4">
                      {(() => {
                        const rate = stats.total > 0 ? (stats.resolved / stats.total) : 0;
                        const pct = Math.round(rate * 100);
                        const radius = 45;
                        const circ = 2 * Math.PI * radius;
                        const strokeOffset = circ - (rate * circ);

                        let rating = "Awaiting Reports";
                        let ratingColor = "text-slate-500";
                        if (stats.total > 0) {
                          if (pct >= 80) { rating = "Outstanding Turnaround"; ratingColor = "text-green-600"; }
                          else if (pct >= 50) { rating = "Moderate Progress"; ratingColor = "text-indigo-600"; }
                          else { rating = "Awaiting Dispatch Actions"; ratingColor = "text-amber-600"; }
                        }

                        return (
                          <div className="flex flex-col items-center space-y-3">
                            <div className="relative w-28 h-28">
                              {/* Background Circle */}
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="56"
                                  cy="56"
                                  r={radius}
                                  className="stroke-slate-100 fill-none"
                                  strokeWidth="8.5"
                                />
                                <circle
                                  cx="56"
                                  cy="56"
                                  r={radius}
                                  className="stroke-indigo-600 fill-none transition-all duration-1000 ease-out"
                                  strokeWidth="8.5"
                                  strokeDasharray={circ}
                                  strokeDashoffset={strokeOffset}
                                  strokeLinecap="round"
                                />
                              </svg>
                              {/* Center Percentage */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black text-slate-800 font-mono leading-none">{pct}%</span>
                                <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Resolved</span>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className={`text-xs font-bold ${ratingColor}`}>{rating}</p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {stats.resolved} out of {stats.total} complaints closed
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Verification Statistics and Consensus Analysis */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-6 hover:shadow-md transition duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ThumbsUp className="w-4 h-4 text-indigo-500" />
                        Community Verification Statistics
                      </h3>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">Consensus Meter</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Citizen upvoting consensus validates reported issues, driving status escalation to &apos;Verified&apos; and queuing public works work orders.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Total Upvotes</p>
                        <p className="text-xl font-extrabold text-indigo-600 font-mono mt-1">
                          +{stats.verificationStats?.totalUpvotes || 0}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Total Downvotes</p>
                        <p className="text-xl font-extrabold text-slate-500 font-mono mt-1">
                          -{stats.verificationStats?.totalDownvotes || 0}
                        </p>
                      </div>
                    </div>

                    {/* Verified ratio progress bar */}
                    {(() => {
                      const ver = stats.verificationStats || { verifiedCount: 0, unverifiedCount: 0 };
                      const totalC = ver.verifiedCount + ver.unverifiedCount;
                      const verPct = totalC > 0 ? (ver.verifiedCount / totalC) * 100 : 0;
                      return (
                        <div className="space-y-2 mt-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Verified consensus
                            </span>
                            <span className="text-indigo-600 font-mono">{Math.round(verPct)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                            <div style={{ width: `${verPct}%` }} className="bg-indigo-600 h-full" />
                            <div style={{ width: `${100 - verPct}%` }} className="bg-slate-300 h-full" />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span>{ver.verifiedCount} Escalated Issues</span>
                            <span>{ver.unverifiedCount} Initial Filings</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Top Affected Locations & Hotspots */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-6 hover:shadow-md transition duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-rose-500" />
                        Top Affected Locations (Grievance Hotspots)
                      </h3>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">SQLite Hotspots</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Hyperlocal geographic addresses logged multiple times or receiving massive citizen validation. Click to view coordinates.
                    </p>

                    <div className="space-y-3">
                      {stats.topAffectedLocations && stats.topAffectedLocations.length > 0 ? (
                        stats.topAffectedLocations.map((loc, idx) => (
                          <div 
                            key={idx}
                            onClick={() => {
                              // Filter list or scroll map if applicable, or copy to clipboard
                              navigator.clipboard.writeText(loc.address);
                              alert(`Copied address: ${loc.address}`);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 cursor-pointer transition duration-150 group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-700 truncate">{loc.address}</p>
                                <p className="text-[10px] text-slate-400 font-medium">Click to copy full address</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <span className="text-xs font-black text-slate-800 font-mono block">{loc.count} reports</span>
                                <span className="text-[9px] text-indigo-500 font-bold block">+{loc.upvotes} upvotes</span>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-400 text-xs py-4 text-center">No recurrence hotspots calculated.</div>
                      )}
                    </div>
                  </div>

                  {/* AI INSIGHTS & STRUCTURAL PATTERNS PANEL */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm lg:col-span-12 hover:shadow-md transition duration-300 overflow-hidden">
                    <div className="bg-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
                          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-1.5">
                            AI Urban Intelligence & Pattern Audits
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Automatic pattern synthesis and procedural remediation recommendations.
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={fetchAIInsights}
                        disabled={aiInsightsLoading}
                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-indigo-500 shadow-sm transition text-xs font-semibold"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${aiInsightsLoading ? "animate-spin" : ""}`} />
                        {aiInsightsLoading ? "Analyzing patterns..." : "Regenerate AI Audit"}
                      </button>
                    </div>

                    {/* AI Insights Content Display */}
                    <div className="p-6">
                      {aiInsightsLoading ? (
                        <div className="space-y-4 animate-pulse">
                          <div className="h-4 bg-slate-100 rounded w-1/3" />
                          <div className="space-y-2.5">
                            <div className="h-3 bg-slate-100 rounded w-full" />
                            <div className="h-3 bg-slate-100 rounded w-5/6" />
                            <div className="h-3 bg-slate-100 rounded w-2/3" />
                          </div>
                          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-slate-100 p-4 rounded-xl space-y-2">
                              <div className="h-3 bg-slate-100 rounded w-1/2" />
                              <div className="h-2.5 bg-slate-100 rounded w-5/6" />
                              <div className="h-2.5 bg-slate-100 rounded w-3/4" />
                            </div>
                            <div className="border border-slate-100 p-4 rounded-xl space-y-2">
                              <div className="h-3 bg-slate-100 rounded w-1/2" />
                              <div className="h-2.5 bg-slate-100 rounded w-5/6" />
                              <div className="h-2.5 bg-slate-100 rounded w-3/4" />
                            </div>
                          </div>
                        </div>
                      ) : aiInsights ? (
                        <div className="space-y-6">
                          {/* Summary Paragraph */}
                          <div className="bg-indigo-50/50 border-l-4 border-indigo-500 p-4 rounded-r-xl">
                            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">Executive Summary</h4>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                              {aiInsights.summary}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Identified Structural Patterns */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-indigo-500" />
                                Detected Infrastructure Patterns
                              </h4>
                              <div className="space-y-3">
                                {aiInsights.patterns && aiInsights.patterns.map((pat, idx) => (
                                  <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 text-xs text-slate-600 leading-relaxed font-medium flex gap-2.5 shadow-xs hover:border-slate-300 transition duration-150">
                                    <span className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                                      {idx + 1}
                                    </span>
                                    <span>{pat}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Municipal Policy Recommendations */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Briefcase className="w-4 h-4 text-emerald-500" />
                                Actionable Municipal Policy Advice
                              </h4>
                              <div className="space-y-3">
                                {aiInsights.recommendations && aiInsights.recommendations.map((rec, idx) => (
                                  <div key={idx} className="bg-emerald-50/20 p-3.5 rounded-xl border border-emerald-100 text-xs text-slate-600 leading-relaxed font-medium flex gap-2.5 shadow-xs hover:border-emerald-200 transition duration-150">
                                    <span className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                                      {idx + 1}
                                    </span>
                                    <span>{rec}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <button
                            onClick={fetchAIInsights}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-4 h-4" />
                            Analyze Civic Database Patterns
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Bottom Center Refresh Stats Button */}
                <div className="flex justify-center mt-8 pb-4">
                  <button
                    onClick={() => {
                      fetchData();
                      fetchAIInsights();
                    }}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 px-5 py-2.5 rounded-xl border border-slate-300 shadow-md hover:shadow-lg hover:border-indigo-500 active:scale-95 transition-all text-xs font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Stats
                  </button>
                </div>
              </>
            )}
              </div>
            )}

            {/* 3. AI CIVIC ASSISTANT CHAT */}
            {activeTab === "assistant" && (
              <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-[520px]">
                
                {/* Executive Command Header Bar */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-3.5 text-white flex items-center justify-between shadow-xs shrink-0 rounded-t-none">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-white/10 rounded-lg">
                      <Briefcase className="w-4 h-4 text-indigo-100 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold tracking-wide uppercase text-indigo-100 flex items-center gap-1">
                        Municipal Control Center
                        <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-normal">
                          Live Agentic
                        </span>
                      </h3>
                      <p className="text-[10px] text-white/80 font-medium">Operations, Audit & Hotspot Dispatch</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => executeSendMessage("Generate today's municipal briefing", true)}
                      disabled={chatLoading}
                      className="bg-white hover:bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Generate Daily AI Briefing
                    </button>
                    <button
                      type="button"
                      onClick={handleClearChat}
                      className="p-1.5 bg-indigo-700 hover:bg-indigo-800 rounded-lg text-indigo-200 hover:text-white transition-colors cursor-pointer"
                      title="Clear conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chat Message Window */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                  {chatMessages.map((msg, i) => (
                    <div key={msg.id || i} className="space-y-2">
                      <div
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm relative group transition-all ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-tr-none"
                            : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                        }`}>
                          
                          {/* Hover action bar (Copy button for assistant, etc) */}
                          {msg.role === "assistant" && !msg.isTyping && (
                            <button
                              onClick={() => copyToClipboard(msg.content, msg.id || i.toString())}
                              className="absolute top-2 right-2 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer shadow-xs"
                              title="Copy response"
                            >
                              {copiedId === (msg.id || i.toString()) ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}

                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>AI Operations Officer</span>
                            </div>
                          )}

                          {/* Message Content Rendered with customized Markdown formatting */}
                          <div className="prose prose-slate max-w-none text-xs">
                            {msg.role === "user" ? (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                              <ReactMarkdown
                                components={{
                                  h1: ({node, ...props}) => <h1 className="text-sm font-bold text-slate-900 mt-3 mb-1.5 border-b border-slate-100 pb-1 flex items-center gap-1" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-xs font-bold text-slate-900 mt-2.5 mb-1" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-xs font-bold text-slate-800 mt-2 mb-1" {...props} />,
                                  p: ({node, ...props}) => <p className="text-xs leading-relaxed text-slate-700 my-1" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc pl-4 text-xs space-y-0.5 my-1" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal pl-4 text-xs space-y-0.5 my-1" {...props} />,
                                  li: ({node, ...props}) => <li className="text-xs text-slate-700" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
                                  code: ({node, ...props}) => <code className="bg-slate-100 font-mono text-[10px] px-1 py-0.5 rounded text-indigo-600" {...props} />,
                                  pre: ({node, ...props}) => <pre className="bg-slate-900 text-slate-100 font-mono text-[10px] p-2.5 rounded-lg overflow-x-auto my-1.5 leading-normal shadow-inner" {...props} />,
                                  table: ({node, ...props}) => <div className="overflow-x-auto my-2 rounded-lg border border-slate-200 shadow-xs"><table className="w-full border-collapse text-[10px]" {...props} /></div>,
                                  thead: ({node, ...props}) => <thead className="bg-slate-50 border-b border-slate-200" {...props} />,
                                  th: ({node, ...props}) => <th className="border border-slate-200 px-2 py-1 text-left font-bold text-slate-700" {...props} />,
                                  td: ({node, ...props}) => <td className="border border-slate-200 px-2 py-1 text-slate-600 font-medium" {...props} />
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            )}
                          </div>

                          {/* Message Footer / Timestamp */}
                          <div className={`text-[8px] mt-1.5 font-semibold text-right ${msg.role === "user" ? "text-indigo-200" : "text-slate-400"}`}>
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                          </div>

                        </div>
                      </div>

                      {/* Suggested Questions empty state below the welcome greeting */}
                      {i === 0 && chatMessages.length === 1 && (
                        <div className="flex flex-col gap-2 max-w-[85%] pl-2.5 mt-2 animate-fade-in">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-indigo-500" />
                            Suggested Operations Queries
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { label: "Which area needs immediate attention?", prompt: "Which area needs immediate attention?" },
                              { label: "Generate today's municipal briefing", prompt: "Generate today's municipal briefing", isBrief: true },
                              { label: "Show highest priority complaints", prompt: "Which complaints require immediate attention?" },
                              { label: "Which department is overloaded?", prompt: "Which department currently has the highest workload?" },
                              { label: "Show unresolved issues", prompt: "Show unresolved pothole complaints." }
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => executeSendMessage(q.prompt, q.isBrief)}
                                className="text-left text-xs bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center justify-between group active:scale-[0.99] cursor-pointer"
                              >
                                <span className="font-semibold">{q.label}</span>
                                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md opacity-70 group-hover:opacity-100 transition-opacity">
                                  Query DB →
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Pulsing Loading Indicator */}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-500 shadow-sm flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" />
                        <span className="font-semibold text-slate-600">AI Operations Officer is compiling report</span>
                        <div className="flex gap-1 items-center ml-1 mt-0.5">
                          <span className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input Bar */}
                <form onSubmit={handleSendChat} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask standard operations queries, workload metrics, or audit safety logs..."
                    className="flex-1 text-xs border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner font-medium text-slate-700"
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || chatLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-xs cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

          </div>

          {/* BOTTOM TIMELINE AND HISTORY OF ISSUES */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-500" />
                Hyperlocal Activity Ledger ({filteredComplaints.length} Issues)
              </h3>
              
              {/* Reset seed helper button */}
              <button
                onClick={fetchData}
                className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Feed
              </button>
            </div>

            {/* Scrolling Feed Cards */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
              {filteredComplaints.map(comp => {
                const isSelected = selectedId === comp.id;
                return (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedId(comp.id)}
                    className={`flex-shrink-0 w-64 text-left border rounded-xl p-3 transition-all relative ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${getSeverityBadge(comp.severity)}`}>
                        {comp.severity}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400">
                        {new Date(comp.reportedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 truncate mb-1">{comp.title}</h4>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mb-2">{comp.description}</p>
                    
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 font-semibold">
                      <span className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3 h-3 shrink-0" /> {comp.category}
                      </span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <ThumbsUp className="w-3 h-3 text-indigo-500 shrink-0" /> {comp.upvotes} Votes
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredComplaints.length === 0 && (
                <div className="w-full py-10 flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 px-4">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-2 shadow-xs">
                    <Activity className="w-5 h-5 text-indigo-500 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">No Ledger Activities Found</h4>
                  <p className="text-[10px] text-slate-500 max-w-sm mt-1 mb-3.5 leading-relaxed">
                    There are no reported hazards matching your active filters. Try resetting the filters or filing a new report to populate the activity timeline.
                  </p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setCatFilter("All");
                      setSevFilter("All");
                      setStatusFilter("All");
                      setDeptFilter("All");
                      setDateFilter("All");
                      setVerifiedOnlyFilter(false);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>

        </section>


        {/* RIGHT COLUMN: ACTION & DETAILED CONTROL PANEL (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* SEARCH & FILTER DRAWER */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search local address, title, keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 focus:outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Category</label>
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Categories</option>
                  <option value="Pothole">Pothole</option>
                  <option value="Road Damage">Road Damage</option>
                  <option value="Garbage Dumping">Garbage Dumping</option>
                  <option value="Garbage">Garbage</option>
                  <option value="Water Leakage">Water Leakage</option>
                  <option value="Broken Streetlight">Broken Streetlight</option>
                  <option value="Streetlight">Streetlight</option>
                  <option value="Drainage Blockage">Drainage Blockage</option>
                  <option value="Drainage">Drainage</option>
                  <option value="Tree">Tree</option>
                  <option value="Electric Hazard">Electric Hazard</option>
                  <option value="Other">Other</option>
                  <option value="General Complaint">General Complaint</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Severity</label>
                <select
                  value={sevFilter}
                  onChange={(e) => setSevFilter(e.target.value)}
                  className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Severities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Reported">Reported</option>
                  <option value="Analyzed">Analyzed</option>
                  <option value="Verified">Verified</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Department</label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Depts</option>
                  <option value="Public Works">Public Works</option>
                  <option value="Sanitation">Sanitation</option>
                  <option value="Water Authority">Water Authority</option>
                  <option value="Electricity & Power">Electricity</option>
                  <option value="Sewage Board">Sewage Board</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Date Filed</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Time</option>
                  <option value="Today">Today</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 pt-4 pl-1">
                <input
                  type="checkbox"
                  id="verified_only"
                  checked={verifiedOnlyFilter}
                  onChange={(e) => setVerifiedOnlyFilter(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <label htmlFor="verified_only" className="text-[10px] font-semibold text-slate-600 cursor-pointer select-none">
                  Verified Only
                </label>
              </div>
            </div>
          </div>

          {/* DYNAMIC WORKSPACE CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[450px]">
            
            <AnimatePresence mode="wait">
              {!selectedComplaint ? (
                
                // CASE A: REPORT AN ISSUE FORM (When no complaint is selected)
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-5 flex flex-col space-y-4"
                >
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <div>
                      <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-indigo-600" />
                        Report a Hyperlocal Hazard
                      </h2>
                      <p className="text-[10px] text-slate-500">Submit an issue and let Gemini AI automatically classify details.</p>
                    </div>
                  </div>

                  {/* Drag-and-Drop Image Area */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" /> Upload Image & Let Gemini Auto-Fill Form
                    </label>
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl p-4 bg-slate-50 hover:bg-indigo-50/10 transition-all text-center relative flex flex-col items-center justify-center cursor-pointer min-h-[110px]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      {formImage ? (
                        <div className="flex items-center gap-3 text-left w-full">
                          <img src={formImage} className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-sm" referrerPolicy="no-referrer" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">Image uploaded successfully</p>
                            <p className="text-[9px] text-slate-400">Click or drag another photo to update</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <p className="text-xs font-bold text-slate-600">Drag issue photo here, or browse files</p>
                          <p className="text-[9px] text-slate-400">Supports JPEG, PNG, WEBP (Max 10MB)</p>
                        </>
                      )}

                      {/* Real-time Loading Indicator overlay */}
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-2 z-10 transition-all">
                          <Sparkles className="w-6 h-6 text-indigo-600 animate-spin" />
                          <p className="text-xs font-bold text-indigo-700 animate-pulse">Gemini AI is analyzing image...</p>
                          <p className="text-[9px] text-slate-400">Detecting category, severity & suggested department</p>
                        </div>
                      )}
                    </div>

                    {aiWarning && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 text-[10px] text-amber-800 animate-fade-in">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">AI Analysis Notice</p>
                          <p>{aiWarning}</p>
                        </div>
                      </div>
                    )}

                    {aiError && (
                      <div className="mt-2 bg-rose-50/70 border border-rose-200 rounded-lg p-2.5 flex items-start gap-2 text-[10px] text-rose-800 animate-fade-in">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Analysis Warning</p>
                          <p>{aiError}</p>
                        </div>
                      </div>
                    )}

                    {submitSuccess && (
                      <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-start gap-2 text-[10px] text-emerald-800 animate-fade-in">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Success</p>
                          <p>{submitSuccess}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-3.5">
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Category</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-2 focus:outline-none"
                        >
                          <option value="Pothole">Pothole</option>
                          <option value="Garbage Dumping">Garbage Dumping</option>
                          <option value="Water Leakage">Water Leakage</option>
                          <option value="Broken Streetlight">Broken Streetlight</option>
                          <option value="Drainage Blockage">Drainage Blockage</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Severity</label>
                        <select
                          value={formSeverity}
                          onChange={(e) => setFormSeverity(e.target.value as any)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-2 focus:outline-none"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Responsible Department</label>
                      <select
                        value={formDept}
                        onChange={(e) => setFormDept(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-2 focus:outline-none"
                      >
                        <option value="Public Works">Public Works</option>
                        <option value="Sanitation">Sanitation</option>
                        <option value="Water Authority">Water Authority</option>
                        <option value="Electricity & Power">Electricity & Power</option>
                        <option value="Sewage Board">Sewage Board</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Broken water pipe leaking onto roadway"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Description</label>
                      <textarea
                        rows={2.5}
                        placeholder="Provide details about the issue size, hazard potential, or surrounding block conditions..."
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 focus:outline-none resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Address / Street Location</label>
                        <input
                          type="text"
                          placeholder="Address, City, India"
                          value={formAddress}
                          onChange={(e) => setFormAddress(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Reporter (Optional)</label>
                        <input
                          type="text"
                          placeholder="Alex C."
                          value={formReporter}
                          onChange={(e) => setFormReporter(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-2.5 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Interactive Coordinates Indicator */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500 font-mono">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Coordinates Selected:</span>
                      </div>
                      <span className="font-semibold text-slate-700">
                        {formLat.toFixed(5)}, {formLng.toFixed(5)}
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs tracking-wide shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Submit Complaint to Citizen Database
                    </button>

                  </form>
                </motion.div>
              ) : (
                
                // CASE B: DETAILED COMPLAINT SPEC VIEW (When complaint is selected)
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col flex-1 divide-y divide-slate-100 max-h-[85vh] overflow-y-auto"
                >
                  {/* Photo & Back Row */}
                  <div className="relative h-44 bg-slate-900 flex-shrink-0">
                    <img
                      src={selectedComplaint.imageUrl}
                      alt={selectedComplaint.title}
                      className="w-full h-full object-cover opacity-85"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    
                    {/* Back Button */}
                    <button
                      onClick={() => setSelectedId(null)}
                      className="absolute top-3 left-3 bg-white/95 backdrop-blur shadow-md hover:bg-slate-100 text-slate-800 p-2 rounded-xl transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    {/* Quick Category Indicator floating top right */}
                    <span className="absolute top-3 right-3 bg-indigo-600 border border-indigo-500/30 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-full shadow-lg">
                      {selectedComplaint.category}
                    </span>

                    {/* Floating title address over image */}
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-sm font-black text-white leading-tight mb-1">{selectedComplaint.title}</h3>
                      <p className="text-[10px] text-slate-300 flex items-center gap-1 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> {selectedComplaint.location.address}
                      </p>
                    </div>
                  </div>

                  {/* Section: Status Timeline, Metadata Details */}
                  <div className="p-4 space-y-3.5">
                    
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reporter: {selectedComplaint.reportedBy}</span>
                        <span className="text-slate-300">|</span>
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(selectedComplaint.reportedAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex gap-1.5">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded border ${getSeverityBadge(selectedComplaint.severity)}`}>
                          Severity: {selectedComplaint.severity}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded border ${getStatusBadge(selectedComplaint.status)}`}>
                          {selectedComplaint.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      {selectedComplaint.description}
                    </p>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>Suggested Dept:</span>
                      <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-lg text-[10px] font-mono">
                        {selectedComplaint.department}
                      </span>
                    </div>

                    {/* Section: Community Verification voting */}
                    <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                      <div className="space-y-0.5 text-center sm:text-left">
                        <p className="text-xs font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-1">
                          <Heart className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                          Community Integrity Verification
                        </p>
                        <p className="text-[10px] text-slate-500">Does this hazard exist? Upvote to escalate to government attention.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerify("upvote")}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-emerald-600 hover:text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Verify ({selectedComplaint.upvotes})</span>
                        </button>
                        <button
                          onClick={() => handleVerify("downvote")}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-rose-600 hover:text-rose-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>Flag ({selectedComplaint.downvotes})</span>
                        </button>
                      </div>
                    </div>

                    {/* Simulated Admin Action dropdown for government officials */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-700">Municipal Command Simulator</p>
                          <p className="text-[8px] text-slate-400">Update status for testing purposes</p>
                        </div>
                      </div>
                      <select
                        value={selectedComplaint.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="text-[10px] font-bold bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Reported">Reported</option>
                        <option value="Analyzed">Analyzed</option>
                        <option value="Verified">Verified</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>

                  </div>

                  {/* Section: Real-time Gemini Image Analysis Details */}
                  {selectedComplaint.aiAnalysis && (
                    <div className="p-4 space-y-3 bg-indigo-50/10">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        Gemini AI Intelligent Ingestion Assessment
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-[10px]">
                        <div className="bg-white border border-indigo-100 p-2.5 rounded-xl shadow-sm">
                          <p className="text-slate-400 uppercase font-bold text-[8px]">Confidence Score</p>
                          <p className="text-xs font-black text-slate-800 mt-1">{(selectedComplaint.aiAnalysis.confidence * 100).toFixed(0)}% Match</p>
                        </div>
                        <div className="bg-white border border-indigo-100 p-2.5 rounded-xl shadow-sm">
                          <p className="text-slate-400 uppercase font-bold text-[8px]">Urgency Rating</p>
                          <p className="text-xs font-black text-slate-800 mt-1">{selectedComplaint.aiAnalysis.priorityScore}/100 Priority</p>
                        </div>
                        <div className="bg-white border border-indigo-100 p-2.5 rounded-xl col-span-2 shadow-sm">
                          <p className="text-slate-400 uppercase font-bold text-[8px] flex items-center gap-1">
                            <ShieldAlert className="text-rose-500 w-3 h-3" /> Citizen Safety Directive
                          </p>
                          <p className="text-slate-700 mt-1 leading-relaxed">{selectedComplaint.aiAnalysis.citizenSafetyAdvice}</p>
                        </div>
                        <div className="bg-white border border-indigo-100 p-2.5 rounded-xl col-span-2 shadow-sm">
                          <p className="text-slate-400 uppercase font-bold text-[8px]">Civil Risk Disclosure</p>
                          <p className="text-slate-700 mt-1 leading-relaxed">{selectedComplaint.aiAnalysis.riskAssessment}</p>
                        </div>
                        <div className="bg-white border border-indigo-100 p-2.5 rounded-xl col-span-2 shadow-sm">
                          <p className="text-slate-400 uppercase font-bold text-[8px]">Target Remedial Days</p>
                          <p className="text-xs font-black text-indigo-600 mt-1">
                            SLA Mandate: Fix within {selectedComplaint.aiAnalysis.estimatedResolutionDays} Days
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section: AI Summarized Complaint Notice & Suggested Action Plan */}
                  <div className="p-4 space-y-3.5 bg-slate-50 border-t border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          AI Formal Filing Summary
                        </h4>
                        <p className="text-[9px] text-slate-400">Compile formal notice and action checklists dynamically.</p>
                      </div>

                      {!selectedComplaint.summary && (
                        <button
                          onClick={handleGenerateSummary}
                          disabled={isSummarizing}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm"
                        >
                          {isSummarizing ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Summarizing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" /> Generate Briefing
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {isSummarizing && (
                      <div className="p-4 bg-white border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                        <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                        <p className="text-xs font-bold text-slate-600 animate-pulse">Gemini AI is processing details...</p>
                        <p className="text-[9px] text-slate-400">Synthesizing civil brief & technical checklist</p>
                      </div>
                    )}

                    {selectedComplaint.summary && (
                      <div className="space-y-3">
                        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm text-slate-700 text-[10px] leading-relaxed whitespace-pre-wrap font-mono border-l-4 border-l-indigo-500">
                          {selectedComplaint.summary}
                        </div>

                        {selectedComplaint.actionPlan && (
                          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm space-y-2">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">AI Suggested Contractor Action Plan:</p>
                            <div className="space-y-1.5">
                              {selectedComplaint.actionPlan.map((step, idx) => (
                                <label key={idx} className="flex items-start space-x-2 text-[10px] text-slate-600 select-none cursor-pointer">
                                  <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                  <span>{step}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section: User Comments and Community Discussion */}
                  <div className="p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      Community Discussion ({comments.length})
                    </h4>

                    {/* List of Comments */}
                    <div className="space-y-3.5">
                      {comments.map(comm => (
                        <div key={comm.id} className="text-[10px] leading-relaxed">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800">{comm.author}</span>
                            <span className="text-slate-400">{new Date(comm.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-600 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                            {comm.text}
                          </p>
                        </div>
                      ))}

                      {commentLoading && (
                        <p className="text-xs text-slate-400 italic text-center">Loading comments...</p>
                      )}

                      {comments.length === 0 && !commentLoading && (
                        <div className="text-center py-4 px-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                          <MessageSquare className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
                          <p className="text-[10px] text-slate-400 italic font-medium">
                            No comments posted yet. Start the discussion below!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Comment Form */}
                    <form onSubmit={handleCommentSubmit} className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Your Name (e.g. resident)"
                          value={commentAuthor}
                          onChange={(e) => setCommentAuthor(e.target.value)}
                          className="text-[10px] border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-2 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!commentAuthor || !commentText}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg transition-all"
                        >
                          Add Comment
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Add to description or report on-site updates..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="w-full text-[10px] border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 focus:outline-none"
                      />
                    </form>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl w-full mx-auto px-4 mt-8 border-t border-slate-200 pt-4 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 font-semibold gap-3">
        <p>© 2026 Community Hero Inc. Supporting clean and safe municipal infrastructure everywhere.</p>
        <p className="flex items-center gap-1.5 font-mono bg-slate-100 px-3 py-1 rounded-full text-slate-500 text-[10px] border border-slate-200">
          <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Running server-side integration via Cloud Run
        </p>
      </footer>

    </div>
  );
}
