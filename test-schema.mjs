import { createGraphInputSchema } from "./lib/services/graph.service.ts"

console.log("Schema type:", typeof createGraphInputSchema)
console.log("Has safeParse:", typeof createGraphInputSchema?.safeParse)
console.log("Schema keys:", Object.keys(createGraphInputSchema || {}))
console.log("Schema:", createGraphInputSchema)
