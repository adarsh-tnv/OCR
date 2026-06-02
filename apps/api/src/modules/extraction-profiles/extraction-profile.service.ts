import {
  DEFAULT_EXTRACTION_PROFILES,
  DOCUMENT_CATEGORIES,
  documentCategorySchema,
  extractionProfileSchema,
  updateExtractionProfileSchema,
  type DocumentCategory,
  type ExtractionProfile
} from "@iso-ocr/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

const defaultByCategory = new Map<DocumentCategory, ExtractionProfile>(
  DEFAULT_EXTRACTION_PROFILES.map((profile) => [profile.category, extractionProfileSchema.parse(profile)])
);
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const withDefaultMetadata = (profile: ExtractionProfile): ExtractionProfile => {
  const defaultProfile = defaultByCategory.get(profile.category);
  if (!defaultProfile) return profile;

  const defaultFieldsByKey = new Map(defaultProfile.fields.map((field) => [field.key, field]));
  const defaultCheckpointsByKey = new Map(defaultProfile.checkpoints.map((checkpoint) => [checkpoint.key, checkpoint]));
  const profileFieldKeys = new Set(profile.fields.map((field) => field.key));
  const profileCheckpointKeys = new Set(profile.checkpoints.map((checkpoint) => checkpoint.key));

  return extractionProfileSchema.parse({
    ...profile,
    description: profile.description ?? defaultProfile.description,
    fields: [
      ...profile.fields.map((field) => {
        const defaultField = defaultFieldsByKey.get(field.key);
        if (!defaultField) return field;

        return {
          ...field,
          description: field.description ?? defaultField.description,
          aliases: unique([...(field.aliases ?? []), ...defaultField.aliases])
        };
      }),
      ...defaultProfile.fields.filter((field) => !profileFieldKeys.has(field.key))
    ],
    checkpoints: [
      ...profile.checkpoints.map((checkpoint) => {
        const defaultCheckpoint = defaultCheckpointsByKey.get(checkpoint.key);
        if (!defaultCheckpoint) return checkpoint;

        return {
          ...checkpoint,
          description: checkpoint.description ?? defaultCheckpoint.description
        };
      }),
      ...defaultProfile.checkpoints.filter((checkpoint) => !profileCheckpointKeys.has(checkpoint.key))
    ]
  });
};

const toProfile = (record: {
  category: string;
  label: string;
  description: string | null;
  fields: Prisma.JsonValue;
  checkpoints: Prisma.JsonValue;
}): ExtractionProfile =>
  withDefaultMetadata(
    extractionProfileSchema.parse({
      category: record.category,
      label: record.label,
      ...(record.description ? { description: record.description } : {}),
      fields: record.fields,
      checkpoints: record.checkpoints
    })
  );

export class ExtractionProfileService {
  async ensureDefaults() {
    for (const profile of DEFAULT_EXTRACTION_PROFILES) {
      const exists = await prisma.extractionProfile.findUnique({
        where: { category: profile.category },
        select: { id: true }
      });
      if (exists) continue;

      await prisma.extractionProfile.create({
        data: {
          category: profile.category,
          label: profile.label,
          description: profile.description ?? null,
          fields: profile.fields as unknown as Prisma.InputJsonValue,
          checkpoints: profile.checkpoints as unknown as Prisma.InputJsonValue
        }
      });
    }
  }

  async list() {
    await this.ensureDefaults();
    const profiles = await prisma.extractionProfile.findMany({
      orderBy: { category: "asc" }
    });
    return profiles.map(toProfile);
  }

  async get(category: string): Promise<ExtractionProfile> {
    const parsedCategory = documentCategorySchema.parse(category);
    await this.ensureDefaults();
    const profile = await prisma.extractionProfile.findUnique({
      where: { category: parsedCategory }
    });

    if (profile) return toProfile(profile);
    return extractionProfileSchema.parse(defaultByCategory.get(parsedCategory));
  }

  async update(category: string, rawPayload: unknown) {
    const parsedCategory = documentCategorySchema.parse(category);
    const payload = updateExtractionProfileSchema.parse(rawPayload);
    const current = await this.get(parsedCategory);

    const nextProfile = extractionProfileSchema.parse({
      ...current,
      ...payload,
      category: parsedCategory
    });

    const saved = await prisma.extractionProfile.upsert({
      where: { category: parsedCategory },
      create: {
        category: nextProfile.category,
        label: nextProfile.label,
        description: nextProfile.description ?? null,
        fields: nextProfile.fields as unknown as Prisma.InputJsonValue,
        checkpoints: nextProfile.checkpoints as unknown as Prisma.InputJsonValue
      },
      update: {
        label: nextProfile.label,
        description: nextProfile.description ?? null,
        fields: nextProfile.fields as unknown as Prisma.InputJsonValue,
        checkpoints: nextProfile.checkpoints as unknown as Prisma.InputJsonValue
      }
    });

    return toProfile(saved);
  }

  normalizeCategory(category: unknown): DocumentCategory {
    if (typeof category !== "string" || !category.trim()) return "iso_certificate";
    return documentCategorySchema.parse(category);
  }

  categories() {
    return DOCUMENT_CATEGORIES;
  }
}

export const extractionProfileService = new ExtractionProfileService();
