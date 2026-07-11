import { z } from 'zod'

const sceneFields = {
  sceneGroupId: z.string().min(1).optional(),
  sceneCode: z.string().min(1).optional(),
  sceneTitle: z.string().optional(),
  lensType: z.enum(['dialogue', 'narration', 'thought', 'memory', 'system']).optional(),
  autoStageSpeaker: z.boolean().optional(),
}

const dialogueDataSchema = z.object({
  ...sceneFields,
  role: z.string().max(100),
  text: z.string().max(20_000),
}).strict()

const subtitleDataSchema = z.object({
  ...sceneFields,
  role: z.string().max(100).optional(),
  text: z.string().max(20_000),
  position: z.enum(['top', 'center', 'bottom']).optional(),
  duration: z.number().min(0).max(3_600).optional(),
}).strict()

const choiceDataSchema = z.object({
  ...sceneFields,
  choices: z.array(z.string().max(200)).min(1).max(12),
}).strict()

const backgroundDataSchema = z.object({
  ...sceneFields,
  backgroundId: z.string().min(1).max(2_000),
}).strict()

const characterDataSchema = z.object({
  ...sceneFields,
  characterId: z.string().min(1).max(2_000),
  action: z.enum(['show', 'hide', 'move']),
  expression: z.string().max(100),
  position: z.enum(['left', 'center', 'right']).optional(),
}).strict()

const transitionDataSchema = z.object({
  ...sceneFields,
  effect: z.string().max(100),
  duration: z.number().min(0).max(300),
}).strict()

const delayDataSchema = z.object({ ...sceneFields, seconds: z.number().min(0).max(3_600) }).strict()
const conditionDataSchema = z.object({
  ...sceneFields,
  variable: z.string().min(1).max(100),
  operator: z.enum(['==', '!=', '>', '>=', '<', '<=']),
  value: z.union([z.string(), z.number(), z.boolean()]),
}).strict()
const setVariableDataSchema = z.object({
  ...sceneFields,
  variable: z.string().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean()]),
}).strict()
const jumpDataSchema = z.object({ ...sceneFields, targetScene: z.string().min(1).max(200) }).strict()

const positionSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()

export const proposedNodeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dialogue'), data: dialogueDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('subtitle'), data: subtitleDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('choice'), data: choiceDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('background'), data: backgroundDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('character'), data: characterDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('transition'), data: transitionDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('delay'), data: delayDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('condition'), data: conditionDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('setVariable'), data: setVariableDataSchema, position: positionSchema.optional() }).strict(),
  z.object({ type: z.literal('jump'), data: jumpDataSchema, position: positionSchema.optional() }).strict(),
])

const allowedChangesSchema = z.object({
  role: z.string().max(100).optional(),
  text: z.string().max(20_000).optional(),
  choices: z.array(z.string().max(200)).min(1).max(12).optional(),
  backgroundId: z.string().min(1).max(2_000).optional(),
  characterId: z.string().min(1).max(2_000).optional(),
  action: z.enum(['show', 'hide', 'move']).optional(),
  expression: z.string().max(100).optional(),
  position: z.enum(['top', 'bottom', 'left', 'center', 'right']).optional(),
  duration: z.number().min(0).max(3_600).optional(),
  effect: z.string().max(100).optional(),
  seconds: z.number().min(0).max(3_600).optional(),
  variable: z.string().min(1).max(100).optional(),
  operator: z.enum(['==', '!=', '>', '>=', '<', '<=']).optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  targetScene: z.string().min(1).max(200).optional(),
  sceneGroupId: z.string().min(1).optional(),
  sceneCode: z.string().min(1).optional(),
  sceneTitle: z.string().optional(),
  lensType: z.enum(['dialogue', 'narration', 'thought', 'memory', 'system']).optional(),
  autoStageSpeaker: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, '至少修改一个字段')

const anchorSchema = z.union([
  z.object({ afterNodeId: z.string().min(1) }).strict(),
  z.object({ beforeNodeId: z.string().min(1) }).strict(),
])

export const storyPatchOperationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('addNode'), tempId: z.string().min(1).max(100), node: proposedNodeSchema, anchor: anchorSchema.optional() }).strict(),
  z.object({ kind: z.literal('updateNode'), nodeId: z.string().min(1), changes: allowedChangesSchema }).strict(),
  z.object({ kind: z.literal('removeNode'), nodeId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('addEdge'), sourceRef: z.string().min(1), targetRef: z.string().min(1), sourceHandle: z.string().max(100).optional(), label: z.string().max(200).optional() }).strict(),
  z.object({ kind: z.literal('removeEdge'), edgeId: z.string().min(1) }).strict(),
])

export const storyPatchSchema = z.object({
  operations: z.array(storyPatchOperationSchema).max(200),
}).strict().refine(
  (patch) => patch.operations.filter((operation) => operation.kind === 'addNode').length <= 60,
  '单次补丁最多新增 60 个节点',
)

export type ProposedNode = z.infer<typeof proposedNodeSchema>
export type StoryPatch = z.infer<typeof storyPatchSchema>
export type StoryPatchOperation = z.infer<typeof storyPatchOperationSchema>
