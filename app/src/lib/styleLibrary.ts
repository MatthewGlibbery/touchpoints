// ─── Fixed style presets for journey map storyboarding ─────────────────────────
// Users select one of these; no free-form editing.

export type StylePresetId =
  | 'animated-film-3d'
  | 'claymation'
  | 'editorial-illustration'
  | 'photorealistic'
  | 'corporate-illustration';

export type StylePreset = {
  id: StylePresetId;
  name: string;
  description: string;
  /** The master style block inserted at the top of every image prompt */
  masterPrompt: string;
  /** Character consistency instructions */
  characterPrompt: string;
  /** Environment consistency instructions */
  environmentPrompt: string;
  /** Composition instructions */
  compositionPrompt: string;
  /** Negative constraints appended at the end */
  negativePrompt: string;
  /** Relative path to the example thumbnail in /public */
  exampleImage: string;
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'animated-film-3d',
    name: 'Animated Film 3D',
    description: 'Warm, expressive 3D scenes with polished cinematic storytelling.',
    masterPrompt:
      'Premium stylized 3D animated feature-film aesthetic. Expressive appealing characters with realistic emotional acting, large expressive eyes, clean facial design, carefully sculpted forms, soft global illumination, physically based rendering, cinematic depth of field, rich material detail, subtle skin softness, high-end animated movie quality, warm cinematic lighting, sophisticated color grading, readable silhouettes, polished production design, emotionally engaging visual storytelling, believable but stylized environments, simplified realism, premium family-film visual language. Every scene should feel like a still frame from a major animated feature film. Maintain consistent character proportions, costume design, facial features, lighting, materials, and color palette across all scenes.',
    characterPrompt:
      'Character consistency is critical. The primary character should appear as the same stylized 3D person in every frame, with the same facial structure, eye shape, hairstyle, body proportions, skin tone, clothing, accessories, and emotional range. Expressions and poses may change to match the scene, but the underlying character design must remain identical.',
    environmentPrompt:
      'The environment should be a believable but simplified service world with polished stylized 3D production design. Use consistent architecture, props, colors, lighting, and material treatment across all related storyboard frames. Locations may change, but they should feel like part of the same animated world.',
    compositionPrompt:
      'Use cinematic storyboard framing with a clear focal point, readable character pose, and simple visual hierarchy. Prefer medium shots, over-the-shoulder shots, or slightly wide shots that show both the character emotion and the service touchpoint. Use shallow depth of field only when it helps focus attention.',
    negativePrompt:
      'Avoid childish cartoon exaggeration, toy-like plastic surfaces, generic mascot design, cluttered backgrounds, unreadable facial expressions, excessive fantasy elements, distorted hands, extra fingers, text in the image, logos, watermarks, and brand marks.',
    exampleImage: '/style-examples/animated-film-3d.png',
  },
  {
    id: 'claymation',
    name: 'Claymation',
    description: 'Handcrafted stop-motion scenes with tactile miniature sets and clay characters.',
    masterPrompt:
      'Premium handcrafted stop-motion clay animation aesthetic. Physical sculpted clay characters with visible handcrafted texture, subtle fingerprints, hand-shaped forms, miniature practical sets, realistic studio photography, soft cinematic lighting, shallow depth of field, detailed handcrafted props, tactile materials, warm and inviting atmosphere. Every object should appear physically built by skilled model makers. The image should feel like a frame from a high-end stop-motion film. Maintain consistent clay sculpt design, character proportions, clothing details, facial structure, lighting, set materials, and color palette across all scenes.',
    characterPrompt:
      'The character should appear as the same clay puppet in every frame. Keep the same clay face sculpt, hairstyle shape, clothing colors, outfit pieces, body proportions, skin tone, and accessories. Expressions may change through clay facial posing, but the sculpt identity must remain consistent.',
    environmentPrompt:
      'The environment should look like a miniature practical set built by hand. Use physical paper props, clay or foam objects, miniature furniture, handmade technology devices, small-scale set dressing, and realistic studio lighting. Keep scale, material texture, and set design consistent across frames.',
    compositionPrompt:
      'Use stop-motion film photography with a clear focal point, shallow depth of field, tactile foreground details, and readable character acting. Prefer medium shots or slightly wide shots that show the physical set and the service touchpoint.',
    negativePrompt:
      'Avoid glossy plastic toy appearance, computer-generated smoothness, hyperreal human skin, flat vector graphics, messy clutter, horror tones, creepy doll features, excessive wrinkles, distorted hands, extra fingers, text in the image, logos, watermarks, and brand marks.',
    exampleImage: '/style-examples/claymation.png',
  },
  {
    id: 'editorial-illustration',
    name: 'Editorial Illustration',
    description: 'Clean, professional editorial visuals with simplified geometric figures.',
    masterPrompt:
      'Premium contemporary editorial illustration. Sophisticated geometric character design. Clean vector-inspired forms. Simplified human figures. Limited but refined color palette. Flat and semi-flat shading. Subtle texture grain. Modern design-system aesthetic. Elegant composition. Minimal facial detail. Strong visual hierarchy. Highly readable storytelling. Enterprise-grade illustration style suitable for technology companies, consulting firms, product design teams, and service design artifacts. Maintain consistent proportions, color palette, illustration language, character silhouettes, line quality, shading approach, and visual system across all scenes.',
    characterPrompt:
      'Render the character using the same simplified editorial illustration system in every frame. Keep the same silhouette, hairstyle shape, skin tone, clothing colors, outfit pieces, body proportions, and minimal facial feature treatment. Do not add unnecessary detail or realistic texture to the character.',
    environmentPrompt:
      'Use simplified service environments with reduced visual complexity. Emphasize only the objects that matter to the service moment. Use clean architectural forms, organized layouts, and a consistent product-design illustration language across all scenes.',
    compositionPrompt:
      'Use a clean editorial composition with strong visual hierarchy, generous whitespace, and a clear service action. Prefer simple geometric framing, readable gestures, and minimal background detail. The image should work well inside a journey-map card or storyboard panel.',
    negativePrompt:
      'Avoid photorealism, heavy rendering, overly detailed faces, comic-book drama, childish cartoons, cluttered environments, complex perspective, excessive gradients, illegible UI text, logos, watermarks, brand marks, and written words.',
    exampleImage: '/style-examples/editorial-illustration.png',
  },
  {
    id: 'photorealistic',
    name: 'Photorealistic',
    description: 'Realistic documentary-style photography for grounded service moments.',
    masterPrompt:
      'Premium cinematic documentary photography. Realistic human subjects. Natural body language. Authentic emotional expression. Modern lens photography. Shallow depth of field used selectively. Professional editorial photography quality. Natural lighting. Realistic materials and textures. Subtle cinematic color grading. Documentary realism. High-end commercial photography aesthetic. Authentic workplaces, homes, public spaces, and service environments. The image should feel like a candid but carefully composed frame from a professional documentary or premium brand film. Maintain consistent character appearance, clothing, age, facial features, hairstyle, accessories, environment realism, lighting style, and color treatment across every scene.',
    characterPrompt:
      'The primary character must appear as the same real person throughout the storyboard. Keep the same age, facial structure, skin tone, hairstyle, body type, clothing, accessories, and recognizable physical identity in every frame. Expressions and poses may change, but the person should be unmistakably the same individual.',
    environmentPrompt:
      'Use realistic, contemporary service environments with authentic lighting and believable materials. Avoid staged stock-photo artificiality. Spaces should feel lived-in, functional, and specific to the service context. Keep color grading, lens style, and realism consistent across scenes.',
    compositionPrompt:
      'Use professional documentary composition with a clear service action, realistic body language, and natural framing. Prefer medium shots, over-the-shoulder shots, or environmental portraits. The frame should feel candid but intentionally composed for storytelling.',
    negativePrompt:
      'Avoid uncanny faces, exaggerated smiles, generic stock-photo posing, overproduced corporate cliches, glossy artificial lighting, distorted hands, extra fingers, fake-looking devices, unreadable or nonsensical text, logos, watermarks, brand marks, and written words.',
    exampleImage: '/style-examples/photorealistic.png',
  },
  {
    id: 'corporate-illustration',
    name: 'Corporate Illustration',
    description: 'Friendly enterprise product illustrations for business workflows and SaaS journeys.',
    masterPrompt:
      'Modern enterprise product illustration system. Friendly professional character design. Clean geometric forms. Rounded shapes. Controlled color palette. Soft gradients used sparingly. Simplified environments. Contemporary SaaS visual language. Polished design-system consistency. Clear visual hierarchy. Professional yet approachable tone. High readability for business presentations and service design artifacts. Characters, environments, devices, icons, and props should feel like they belong to one cohesive product illustration library. Maintain consistent illustration framework, proportions, colors, line quality, shading style, UI abstraction, and visual patterns across all storyboard scenes.',
    characterPrompt:
      'Render the character in the same corporate product illustration system throughout all scenes. Keep the same simplified face treatment, hairstyle shape, clothing colors, proportions, skin tone, and silhouette. The character should look professional, approachable, and suitable for enterprise software storytelling.',
    environmentPrompt:
      'Use simplified digital-first service environments such as workspaces, service desks, customer support settings, dashboards, mobile devices, laptops, office interiors, and abstract system elements. Keep objects clean, modular, and consistent with a modern product illustration library.',
    compositionPrompt:
      'Use a clean business-presentation composition with a clear service interaction, strong focal point, and simplified supporting details. The frame should work as a card inside a journey map or service blueprint. Use balanced whitespace and avoid unnecessary decoration.',
    negativePrompt:
      'Avoid photorealism, childish cartooning, overly whimsical shapes, messy sketch lines, heavy painterly textures, complex backgrounds, dramatic comic-book lighting, readable UI text, logos, watermarks, brand marks, and written words.',
    exampleImage: '/style-examples/corporate-illustration.png',
  },
];

/** Get a preset by ID. Falls back to editorial-illustration. */
export function getPreset(id: StylePresetId | string): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[2]; // editorial-illustration default
}

// ─── Legacy compat: old code imported loadPresets/savePreset/deletePreset ──────
// These are no-ops now; kept to avoid import errors during migration.

/** @deprecated — presets are now fixed */
export function loadPresets(): StylePreset[] {
  return STYLE_PRESETS;
}

/** @deprecated — no-op */
export function savePreset(_name: string, _baseStyle: string): StylePreset {
  return STYLE_PRESETS[2];
}

/** @deprecated — no-op */
export function deletePreset(_id: string): void {}
