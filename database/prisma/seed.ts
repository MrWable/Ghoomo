import { hash } from "bcryptjs";
import {
  GuideVerificationStatus,
  PrismaClient,
  UserRole,
} from "../generated/client";

const prisma = new PrismaClient();

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
