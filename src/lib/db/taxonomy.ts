/**
 * NicheScope taxonomy.
 *
 * This dataset is maintained independently of any YouTube API data. It is the
 * structural backbone of niche discovery: categories, niches, sub-niches,
 * aliases and search keywords. It contains no performance statistics — those
 * only ever come from a permitted data source with provenance attached.
 */

export interface TaxonomyNicheSeed {
  name: string;
  aliases?: string[];
  keywords?: string[];
  description?: string;
  featured?: boolean;
  children?: TaxonomyNicheSeed[];
}

export interface TaxonomyCategorySeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  niches: TaxonomyNicheSeed[];
}

const n = (
  name: string,
  extras: Omit<TaxonomyNicheSeed, "name"> = {},
): TaxonomyNicheSeed => ({ name, ...extras });

export const TAXONOMY: TaxonomyCategorySeed[] = [
  {
    slug: "technology",
    name: "Technology",
    description:
      "Software, hardware, security and developer-focused channels — from hands-on tutorials to consumer reviews.",
    icon: "Cpu",
    niches: [
      n("Software Development", {
        aliases: ["Programming", "Coding"],
        featured: true,
        children: [
          n("Web Development", { aliases: ["Frontend Development", "Full Stack Web"] }),
          n("Mobile App Development", { aliases: ["iOS Development", "Android Development"] }),
          n("DevOps & Platform Engineering", { aliases: ["DevOps"] }),
          n("Open Source Projects"),
        ],
      }),
      n("Cybersecurity", {
        aliases: ["InfoSec", "Information Security"],
        children: [
          n("Ethical Hacking", { aliases: ["Penetration Testing"] }),
          n("Privacy & Digital Security"),
          n("Cloud Security"),
        ],
      }),
      n("Consumer Technology", {
        aliases: ["Gadget Reviews", "Tech Reviews"],
        children: [
          n("Smartphone Reviews"),
          n("Smart Home Technology"),
          n("Wearable Technology"),
        ],
      }),
      n("AI Coding", {
        aliases: ["Vibe Coding", "AI-Assisted Development"],
        keywords: ["cursor ide", "github copilot tutorial", "ai pair programming"],
        children: [n("AI Code Assistants"), n("Prompt Engineering for Developers")],
      }),
      n("Cloud Computing", { aliases: ["Cloud Architecture"] }),
      n("Developer Tools", { aliases: ["Dev Tools"] }),
    ],
  },
  {
    slug: "artificial-intelligence",
    name: "Artificial Intelligence",
    description:
      "AI tools, agents, automation and applied machine learning — the fastest-moving category on YouTube.",
    icon: "BrainCircuit",
    niches: [
      n("AI Agents", {
        aliases: ["Autonomous AI"],
        featured: true,
        keywords: ["ai agent tutorial", "agentic workflow", "autonomous agent"],
        children: [n("Agentic Workflows"), n("AI Agent Tutorials")],
      }),
      n("AI Automation", {
        aliases: ["AI Workflow Automation"],
        children: [n("No-Code AI Automation"), n("Business Process Automation")],
      }),
      n("AI Cybersecurity"),
      n("AI Video Generation", {
        aliases: ["AI Filmmaking"],
        children: [n("Faceless AI Video"), n("AI Filmmaking Tools")],
      }),
      n("AI Productivity"),
      n("Machine Learning", {
        aliases: ["ML"],
        children: [n("LLM Fine-Tuning"), n("Computer Vision")],
      }),
    ],
  },
  {
    slug: "finance",
    name: "Finance",
    description:
      "Money, markets and personal wealth — evergreen high-CPM content with strong monetization potential.",
    icon: "Wallet",
    niches: [
      n("Personal Finance", {
        aliases: ["Money Management"],
        featured: true,
        children: [n("Budgeting"), n("Debt Payoff"), n("Frugal Living")],
      }),
      n("Investing", {
        aliases: ["Stock Market"],
        featured: true,
        children: [n("Index Fund Investing"), n("Dividend Investing"), n("Crypto Investing")],
      }),
      n("Financial Education", {
        aliases: ["Financial Literacy"],
        children: [n("Money Basics"), n("Financial Independence")],
      }),
      n("Entrepreneurship", {
        aliases: ["Founders"],
        children: [n("Startup Ideas"), n("Solopreneurship")],
      }),
      n("Side Hustles", { aliases: ["Extra Income"] }),
      n("Passive Income"),
    ],
  },
  {
    slug: "education",
    name: "Education",
    description:
      "Explainer-led learning across science, history, psychology and languages, built for search-driven discovery.",
    icon: "GraduationCap",
    niches: [
      n("Science", {
        aliases: ["Science Explainers"],
        featured: true,
        children: [n("Space Science"), n("Biology Explained")],
      }),
      n("History", { aliases: ["History Documentaries"] }),
      n("Psychology", {
        children: [n("Behavioral Psychology"), n("Productivity Psychology")],
      }),
      n("Mathematics", { aliases: ["Maths"] }),
      n("Language Learning", { aliases: ["Learn English", "Language Study"] }),
      n("Study Skills", { aliases: ["Exam Preparation"] }),
    ],
  },
  {
    slug: "entertainment",
    name: "Entertainment",
    description:
      "Film, television, comedy, reactions and fandom culture with high watch time and rapid trend cycles.",
    icon: "Clapperboard",
    niches: [
      n("Movie Reviews", { aliases: ["Film Reviews"] }),
      n("Celebrity News", { aliases: ["Celebrity Gossip"] }),
      n("Comedy", { aliases: ["Comedy Sketches"], featured: true }),
      n("Reaction Videos"),
      n("Anime", {
        aliases: ["Anime Content"],
        children: [n("Anime Recap"), n("Anime Analysis")],
      }),
      n("Music Discovery", { aliases: ["Music Reviews"] }),
    ],
  },
  {
    slug: "gaming",
    name: "Gaming",
    description:
      "Let's plays, guides, esports and hardware — formats spanning Shorts to long-form livestream VODs.",
    icon: "Gamepad2",
    niches: [
      n("Mobile Gaming", {
        children: [n("Mobile Esports"), n("Gacha Games")],
        featured: true,
      }),
      n("PC Gaming", { children: [n("Game Reviews"), n("PC Builds")] }),
      n("Console Gaming", { aliases: ["PlayStation", "Xbox"] }),
      n("Gaming News", { aliases: ["Gaming Updates"] }),
      n("Esports", { aliases: ["Competitive Gaming"] }),
      n("Game Guides", { aliases: ["Walkthroughs"] }),
    ],
  },
  {
    slug: "health",
    name: "Health",
    description:
      "Fitness, nutrition and wellbeing — high-trust niches where evidence quality and disclaimers matter.",
    icon: "HeartPulse",
    niches: [
      n("Fitness", {
        aliases: ["Workout"],
        featured: true,
        children: [n("Home Workouts"), n("Strength Training")],
      }),
      n("Nutrition", { aliases: ["Diet"] }),
      n("Mental Health", { aliases: ["Wellbeing"] }),
      n("Longevity", { aliases: ["Healthy Ageing"] }),
      n("Weight Loss"),
      n("Sleep Health"),
    ],
  },
  {
    slug: "lifestyle",
    name: "Lifestyle",
    description:
      "Productivity, travel, home and self-improvement content with strong Shorts crossover appeal.",
    icon: "Sparkles",
    niches: [
      n("Minimalism", { aliases: ["Simple Living"] }),
      n("Productivity", { aliases: ["Time Management"], featured: true }),
      n("Travel", { children: [n("Budget Travel"), n("Digital Nomad")] }),
      n("Fashion", { aliases: ["Style"] }),
      n("Home Decor", { aliases: ["Interior Design"] }),
      n("Self-Improvement", { aliases: ["Personal Growth"] }),
    ],
  },
  {
    slug: "business",
    name: "Business",
    description:
      "Marketing, ecommerce and B2B education for operators, founders and freelancers.",
    icon: "Briefcase",
    niches: [
      n("Marketing", { children: [n("SEO"), n("Social Media Marketing")] }),
      n("Ecommerce", {
        children: [n("Dropshipping"), n("Amazon FBA")],
        featured: true,
      }),
      n("Small Business", { aliases: ["Local Business"] }),
      n("Freelancing"),
      n("Leadership", { aliases: ["Management"] }),
      n("SaaS", { aliases: ["Software as a Service"] }),
    ],
  },
  {
    slug: "documentary",
    name: "Documentary",
    description:
      "Long-form investigative and narrative storytelling niches with premium audience attention.",
    icon: "Film",
    niches: [
      n("True Crime", {
        featured: true,
        children: [n("Cold Cases"), n("Unsolved Mysteries")],
      }),
      n("Nature Documentary", { aliases: ["Wildlife"] }),
      n("History Documentary"),
      n("Science Documentary"),
      n("Business Documentary", { aliases: ["Company Stories"] }),
    ],
  },
  {
    slug: "news",
    name: "News",
    description:
      "Current affairs, technology and finance news analysis — high velocity, strict sourcing standards.",
    icon: "Newspaper",
    niches: [
      n("Technology News"),
      n("Finance News"),
      n("Geopolitics"),
      n("Breaking News Analysis"),
      n("Media Criticism"),
    ],
  },
  {
    slug: "sports",
    name: "Sports",
    description:
      "Match analysis, transfer news and athletic storytelling across global leagues.",
    icon: "Trophy",
    niches: [
      n("Football", {
        aliases: ["Soccer"],
        featured: true,
        children: [n("Premier League"), n("Transfer News")],
      }),
      n("Basketball", { aliases: ["NBA"] }),
      n("Combat Sports", { aliases: ["MMA", "Boxing"] }),
      n("Motorsport", { aliases: ["Formula 1"] }),
      n("Fitness Sports", { aliases: ["Running", "Cycling"] }),
    ],
  },
  {
    slug: "food",
    name: "Food",
    description:
      "Recipes, food culture and reviews — highly visual niches that perform strongly in Shorts.",
    icon: "UtensilsCrossed",
    niches: [
      n("Cooking Tutorials", {
        featured: true,
        children: [n("Quick Recipes"), n("Budget Meals")],
      }),
      n("Street Food", { aliases: ["Food Tours"] }),
      n("Baking", { aliases: ["Pastry"] }),
      n("Food Reviews", { aliases: ["Restaurant Reviews"] }),
      n("Meal Prep"),
    ],
  },
  {
    slug: "beauty",
    name: "Beauty",
    description:
      "Skincare, makeup and grooming education with strong product-driven audiences.",
    icon: "Brush",
    niches: [
      n("Skincare", { aliases: ["Skin Care"] }),
      n("Makeup Tutorials", { aliases: ["Makeup"] }),
      n("Haircare"),
      n("Beauty Reviews"),
      n("Men's Grooming", { aliases: ["Mens Grooming"] }),
    ],
  },
  {
    slug: "automotive",
    name: "Automotive",
    description:
      "Vehicle reviews, EV technology and maintenance — valuable, high-intent audiences.",
    icon: "Car",
    niches: [
      n("Car Reviews", {
        featured: true,
        children: [n("EV Reviews"), n("First Car Buying")],
      }),
      n("Electric Vehicles", { aliases: ["EVs"] }),
      n("Car Maintenance", { aliases: ["DIY Car Repair"] }),
      n("Car Modifications", { aliases: ["Car Tuning"] }),
      n("Commercial Vehicles", { aliases: ["Trucks"] }),
    ],
  },
  {
    slug: "family",
    name: "Family",
    description:
      "Parenting, family life and kids education — engaged communities with sensitive-content safeguards.",
    icon: "Users",
    niches: [
      n("Parenting", { aliases: ["Parenthood"] }),
      n("Family Vlogs"),
      n("Kids Education", { aliases: ["Kids Learning"] }),
      n("Pregnancy", { aliases: ["Expecting Parents"] }),
      n("Family Finance"),
    ],
  },
];

/** Flat list of taxonomy rows ready for insertion. */
export interface FlatTaxonomyNiche extends TaxonomyNicheSeed {
  slug: string;
  categorySlug: string;
  parentSlug: string | null;
  depth: number;
}

export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function flattenTaxonomy(): FlatTaxonomyNiche[] {
  const rows: FlatTaxonomyNiche[] = [];
  const seen = new Set<string>();

  const walk = (
    niche: TaxonomyNicheSeed,
    categorySlug: string,
    parentSlug: string | null,
    depth: number,
  ) => {
    let slug = slugifyName(niche.name);
    if (seen.has(slug)) slug = `${slug}-${categorySlug}`;
    seen.add(slug);
    rows.push({ ...niche, slug, categorySlug, parentSlug, depth });
    for (const child of niche.children ?? []) {
      walk(child, categorySlug, slug, depth + 1);
    }
  };

  for (const category of TAXONOMY) {
    for (const niche of category.niches) {
      walk(niche, category.slug, null, 0);
    }
  }
  return rows;
}

export function defaultKeywords(seed: TaxonomyNicheSeed): string[] {
  const base = seed.name.toLowerCase();
  const generated = new Set<string>([
    base,
    `${base} youtube`,
    `${base} videos`,
    `${base} tips`,
    `best ${base} channels`,
  ]);
  for (const alias of seed.aliases ?? []) generated.add(alias.toLowerCase());
  for (const keyword of seed.keywords ?? []) generated.add(keyword.toLowerCase());
  return [...generated].slice(0, 10);
}
