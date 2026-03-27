import { hash } from "bcryptjs";
import {
  GuideVerificationStatus,
  PrismaClient,
  UserRole,
} from "../generated/client";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toBase64(svg: string) {
  return Buffer.from(svg).toString("base64");
}

function buildCityIllustration({
  title,
  label,
  primary,
  secondary,
}: {
  title: string;
  label: string;
  primary: string;
  secondary: string;
}) {
  return toBase64(`
    <svg width="900" height="700" viewBox="0 0 900 700" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="108" y1="46" x2="742" y2="654" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFE2BF" />
          <stop offset="0.46" stop-color="#F8EFE3" />
          <stop offset="1" stop-color="#D0E4DE" />
        </linearGradient>
        <linearGradient id="hill" x1="238" y1="300" x2="618" y2="688" gradientUnits="userSpaceOnUse">
          <stop stop-color="${primary}" />
          <stop offset="1" stop-color="#10201C" />
        </linearGradient>
      </defs>
      <rect width="900" height="700" rx="36" fill="url(#bg)" />
      <circle cx="704" cy="132" r="74" fill="#FFF2DB" />
      <path d="M0 454C136 364 260 340 378 386C470 420 546 500 648 512C736 522 816 490 900 430V700H0V454Z" fill="url(#hill)" />
      <path d="M0 562C114 526 232 518 344 548C464 580 548 632 650 634C744 638 824 604 900 560V700H0V562Z" fill="#14312B" />
      <path d="M286 238L366 160L450 238H286Z" fill="#FFF6EA" fill-opacity="0.88" />
      <path d="M394 276L496 174L620 276H394Z" fill="#FFF6EA" fill-opacity="0.72" />
      <path d="M110 594C170 548 234 536 296 558C358 580 406 624 468 620" stroke="${secondary}" stroke-width="12" stroke-linecap="round" stroke-dasharray="12 16" />
      <circle cx="108" cy="594" r="18" fill="#FFF4E1" />
      <circle cx="108" cy="594" r="8" fill="#D66F38" />
      <rect x="56" y="56" width="246" height="76" rx="22" fill="#10211D" fill-opacity="0.8" />
      <text x="86" y="90" fill="#FFD7B3" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2">${label}</text>
      <text x="86" y="118" fill="#FFF7EC" font-family="Arial, sans-serif" font-size="28" font-weight="700">${title}</text>
    </svg>
  `);
}

function buildPlaceIllustration({
  title,
  badge,
  sky,
  accent,
}: {
  title: string;
  badge: string;
  sky: string;
  accent: string;
}) {
  return toBase64(`
    <svg width="1200" height="900" viewBox="0 0 1200 900" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="144" y1="62" x2="988" y2="812" gradientUnits="userSpaceOnUse">
          <stop stop-color="${sky}" />
          <stop offset="1" stop-color="#09121A" />
        </linearGradient>
        <linearGradient id="terrain" x1="236" y1="366" x2="874" y2="884" gradientUnits="userSpaceOnUse">
          <stop stop-color="${accent}" />
          <stop offset="1" stop-color="#0F1E1C" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" rx="40" fill="url(#sky)" />
      <circle cx="904" cy="168" r="90" fill="#FFF2DA" fill-opacity="0.84" />
      <path d="M0 562C142 470 262 438 378 460C518 486 614 610 770 618C920 626 1042 536 1200 440V900H0V562Z" fill="url(#terrain)" />
      <path d="M0 684C170 620 300 622 430 676C542 722 636 792 768 794C898 794 1020 732 1200 642V900H0V684Z" fill="#091713" />
      <path d="M248 500L386 346L520 500H248Z" fill="#F8F0E4" fill-opacity="0.9" />
      <path d="M442 544L598 356L756 544H442Z" fill="#F8F0E4" fill-opacity="0.68" />
      <path d="M188 594C290 562 388 564 484 610C580 656 650 742 742 748" stroke="#F6E1C4" stroke-width="18" stroke-linecap="round" stroke-dasharray="18 20" />
      <rect x="70" y="70" width="290" height="84" rx="24" fill="#0B1619" fill-opacity="0.7" />
      <text x="102" y="106" fill="#F6C894" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">${badge}</text>
      <text x="102" y="138" fill="#FFF8EF" font-family="Arial, sans-serif" font-size="30" font-weight="700">${title}</text>
    </svg>
  `);
}

async function seedCities() {
  const cities = [
    {
      name: "Pune",
      summary: "Heritage routes, student-friendly districts, and compact city tours.",
      imageBase64: buildCityIllustration({
        title: "Old city trails and modern neighborhoods",
        label: "PUNE LIVE",
        primary: "#274C45",
        secondary: "#FAD7B0",
      }),
      places: [
        {
          name: "Shaniwar Wada",
          summary: "A fort palace stop for Maratha history, evening walks, and dramatic architecture.",
          imageBase64: buildPlaceIllustration({
            title: "Stone gateways and royal courtyards",
            badge: "FORT WALK",
            sky: "#325B57",
            accent: "#B86435",
          }),
        },
        {
          name: "FC Road",
          summary: "The compact student corridor for snacks, casual shopping, and high-energy evenings.",
          imageBase64: buildPlaceIllustration({
            title: "Street food, bookstores, and campus spillover",
            badge: "CITY PULSE",
            sky: "#204A54",
            accent: "#D27B40",
          }),
        },
      ],
    },
    {
      name: "Nashik",
      summary: "Temple circuits, food walks, and easy access to local vineyard stops.",
      imageBase64: buildCityIllustration({
        title: "Temple routes and wine-country weekends",
        label: "NASHIK LIVE",
        primary: "#1E4A41",
        secondary: "#FFE3BE",
      }),
      places: [
        {
          name: "Ramkund",
          summary: "A sacred riverside stop that anchors temple trails and old-city storytelling.",
          imageBase64: buildPlaceIllustration({
            title: "River ghats and morning rituals",
            badge: "TEMPLE CIRCUIT",
            sky: "#325168",
            accent: "#CA6A35",
          }),
        },
        {
          name: "Sula Vineyards",
          summary: "A soft-day itinerary add-on for tastings, sunset views, and weekend groups.",
          imageBase64: buildPlaceIllustration({
            title: "Vineyard loops with sunset decks",
            badge: "WEEKEND LOOP",
            sky: "#3E6A5A",
            accent: "#A96139",
          }),
        },
      ],
    },
    {
      name: "Kolhapur",
      summary: "Street food, old market energy, and regional heritage stories.",
      imageBase64: buildCityIllustration({
        title: "Bazaar corners and cultural landmarks",
        label: "KOLHAPUR LIVE",
        primary: "#23443D",
        secondary: "#FFE0BB",
      }),
      places: [
        {
          name: "Mahalaxmi Temple",
          summary: "An early-morning cultural anchor with temple history and dense market lanes nearby.",
          imageBase64: buildPlaceIllustration({
            title: "Temple rhythms and market edges",
            badge: "HERITAGE STOP",
            sky: "#554C74",
            accent: "#C96E41",
          }),
        },
        {
          name: "Rankala Lake",
          summary: "An easy evening stop for food carts, promenade walks, and relaxed local pacing.",
          imageBase64: buildPlaceIllustration({
            title: "Lakeside evenings and local food carts",
            badge: "EVENING LOOP",
            sky: "#2D5671",
            accent: "#AA5A3B",
          }),
        },
      ],
    },
  ];

  for (const city of cities) {
    await prisma.city.upsert({
      where: {
        slug: slugify(city.name),
      },
      update: {
        name: city.name,
        summary: city.summary,
        imageBase64: city.imageBase64,
        imageMimeType: "image/svg+xml",
        isActive: true,
        places: {
          deleteMany: {},
          create: city.places.map((place, index) => ({
            name: place.name,
            slug: slugify(place.name),
            summary: place.summary,
            imageBase64: place.imageBase64,
            imageMimeType: "image/svg+xml",
            displayOrder: index,
          })),
        },
      },
      create: {
        name: city.name,
        slug: slugify(city.name),
        summary: city.summary,
        imageBase64: city.imageBase64,
        imageMimeType: "image/svg+xml",
        isActive: true,
        places: {
          create: city.places.map((place, index) => ({
            name: place.name,
            slug: slugify(place.name),
            summary: place.summary,
            imageBase64: place.imageBase64,
            imageMimeType: "image/svg+xml",
            displayOrder: index,
          })),
        },
      },
    });
  }
}

async function seedUsers() {
  const passwordHash = await hash("demo12345", 10);

  await prisma.user.upsert({
    where: { email: "admin@ghoomo.dev" },
    update: {},
    create: {
      fullName: "Ghumo Admin",
      email: "admin@ghoomo.dev",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "anita.guide@ghoomo.dev" },
    update: {
      fullName: "Anita Patil",
      passwordHash,
      role: UserRole.GUIDE,
      guideProfile: {
        upsert: {
          update: {
            city: "Nashik",
            languages: ["English", "Hindi", "Marathi"],
            specialties: ["Wine tours", "Temple trails", "Food walks"],
            bio: "Weekend guide focused on local stories, walking tours, and small-group experiences.",
            hourlyRate: 1200,
            verificationStatus: GuideVerificationStatus.APPROVED,
            isVerified: true,
            isAvailable: true,
          },
          create: {
            city: "Nashik",
            languages: ["English", "Hindi", "Marathi"],
            specialties: ["Wine tours", "Temple trails", "Food walks"],
            bio: "Weekend guide focused on local stories, walking tours, and small-group experiences.",
            hourlyRate: 1200,
            verificationStatus: GuideVerificationStatus.APPROVED,
            isVerified: true,
            isAvailable: true,
          },
        },
      },
    },
    create: {
      fullName: "Anita Patil",
      email: "anita.guide@ghoomo.dev",
      passwordHash,
      role: UserRole.GUIDE,
      guideProfile: {
        create: {
          city: "Nashik",
          languages: ["English", "Hindi", "Marathi"],
          specialties: ["Wine tours", "Temple trails", "Food walks"],
          bio: "Weekend guide focused on local stories, walking tours, and small-group experiences.",
          hourlyRate: 1200,
          verificationStatus: GuideVerificationStatus.APPROVED,
          isVerified: true,
          isAvailable: true,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "sameer.guide@ghoomo.dev" },
    update: {
      fullName: "Sameer Shinde",
      passwordHash,
      role: UserRole.GUIDE,
      guideProfile: {
        upsert: {
          update: {
            city: "Pune",
            languages: ["English", "Hindi"],
            specialties: ["Heritage tours", "Museum circuits", "Student-budget itineraries"],
            bio: "Guide for first-time visitors looking for compact city tours with practical local tips.",
            hourlyRate: 900,
            verificationStatus: GuideVerificationStatus.APPROVED,
            isVerified: true,
            isAvailable: true,
          },
          create: {
            city: "Pune",
            languages: ["English", "Hindi"],
            specialties: ["Heritage tours", "Museum circuits", "Student-budget itineraries"],
            bio: "Guide for first-time visitors looking for compact city tours with practical local tips.",
            hourlyRate: 900,
            verificationStatus: GuideVerificationStatus.APPROVED,
            isVerified: true,
            isAvailable: true,
          },
        },
      },
    },
    create: {
      fullName: "Sameer Shinde",
      email: "sameer.guide@ghoomo.dev",
      passwordHash,
      role: UserRole.GUIDE,
      guideProfile: {
        create: {
          city: "Pune",
          languages: ["English", "Hindi"],
          specialties: ["Heritage tours", "Museum circuits", "Student-budget itineraries"],
          bio: "Guide for first-time visitors looking for compact city tours with practical local tips.",
          hourlyRate: 900,
          verificationStatus: GuideVerificationStatus.APPROVED,
          isVerified: true,
          isAvailable: true,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "tourist@ghoomo.dev" },
    update: {},
    create: {
      fullName: "Demo Tourist",
      email: "tourist@ghoomo.dev",
      passwordHash,
      role: UserRole.TOURIST,
    },
  });
}

async function main() {
  await seedCities();
  await seedUsers();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
