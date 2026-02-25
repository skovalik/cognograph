/**
 * Cluster Engine — Pure Algorithm
 *
 * Produces 4-8 meaningful clusters from arbitrary canvas node layouts
 * using a hybrid 3-pass algorithm:
 *   Pass 1: Grid bucketing (O(n))
 *   Pass 2: Edge-informed merge via union-find (O(e))
 *   Pass 3: PFD constraint enforcement (O(c))
 *
 * Zero external dependencies. Pure functions only.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface NodePosition {
  id: string
  x: number
  y: number
  type: string // 'conversation' | 'task' | 'project' | 'artifact' | 'note' | etc.
  status?: string // 'done' | 'in-progress' | 'blocked' | etc.
}

export interface EdgeInfo {
  source: string
  target: string
}

export interface Cluster {
  id: string // e.g. "cluster-2-3" from grid coords
  nodeIds: string[]
  centroid: { x: number; y: number }
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  dominantType: string // most common node type in cluster
  summary: {
    nodeCount: number
    typeCounts: Record<string, number>
    statusCounts: Record<string, number>
  }
}

// ─── Union-Find ──────────────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string>
  private rank: Map<string, number>

  constructor() {
    this.parent = new Map()
    this.rank = new Map()
  }

  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      this.rank.set(x, 0)
    }
  }

  find(x: string): string {
    let root = x
    // Find root
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!
    }
    // Path compression
    let current = x
    while (current !== root) {
      const next = this.parent.get(current)!
      this.parent.set(current, root)
      current = next
    }
    return root
  }

  union(x: string, y: string): void {
    const rootX = this.find(x)
    const rootY = this.find(y)
    if (rootX === rootY) return

    const rankX = this.rank.get(rootX)!
    const rankY = this.rank.get(rootY)!

    if (rankX < rankY) {
      this.parent.set(rootX, rootY)
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX)
    } else {
      this.parent.set(rootY, rootX)
      this.rank.set(rootX, rankX + 1)
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    for (const key of this.parent.keys()) {
      const root = this.find(key)
      if (!groups.has(root)) {
        groups.set(root, [])
      }
      groups.get(root)!.push(key)
    }
    return groups
  }
}

// ─── Grid key helpers ────────────────────────────────────────────────

function gridKey(gx: number, gy: number): string {
  return `${gx},${gy}`
}

function parseGridKey(key: string): [number, number] {
  const parts = key.split(',')
  return [Number(parts[0]), Number(parts[1])]
}

/** Check if two grid cells are 8-connected (adjacent horizontally, vertically, or diagonally) */
function areAdjacent(keyA: string, keyB: string): boolean {
  const [ax, ay] = parseGridKey(keyA)
  const [bx, by] = parseGridKey(keyB)
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)
}

// ─── Cluster metadata computation ───────────────────────────────────

function computeClusterMetadata(nodeIds: string[], nodesById: Map<string, NodePosition>): {
  centroid: { x: number; y: number }
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  dominantType: string
  summary: {
    nodeCount: number
    typeCounts: Record<string, number>
    statusCounts: Record<string, number>
  }
} {
  let sumX = 0
  let sumY = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const typeCounts: Record<string, number> = {}
  const statusCounts: Record<string, number> = {}

  for (const id of nodeIds) {
    const node = nodesById.get(id)!
    sumX += node.x
    sumY += node.y
    if (node.x < minX) minX = node.x
    if (node.y < minY) minY = node.y
    if (node.x > maxX) maxX = node.x
    if (node.y > maxY) maxY = node.y

    typeCounts[node.type] = (typeCounts[node.type] || 0) + 1
    if (node.status) {
      statusCounts[node.status] = (statusCounts[node.status] || 0) + 1
    }
  }

  // Find dominant type
  let dominantType = ''
  let maxTypeCount = 0
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxTypeCount) {
      maxTypeCount = count
      dominantType = type
    }
  }

  return {
    centroid: { x: sumX / nodeIds.length, y: sumY / nodeIds.length },
    bounds: { minX, minY, maxX, maxY },
    dominantType,
    summary: {
      nodeCount: nodeIds.length,
      typeCounts,
      statusCounts
    }
  }
}

// ─── Centroid distance between two clusters (by node lists) ─────────

function centroidDistance(
  nodesA: string[],
  nodesB: string[],
  nodesById: Map<string, NodePosition>
): number {
  let axSum = 0
  let aySum = 0
  for (const id of nodesA) {
    const n = nodesById.get(id)!
    axSum += n.x
    aySum += n.y
  }
  let bxSum = 0
  let bySum = 0
  for (const id of nodesB) {
    const n = nodesById.get(id)!
    bxSum += n.x
    bySum += n.y
  }
  const ax = axSum / nodesA.length
  const ay = aySum / nodesA.length
  const bx = bxSum / nodesB.length
  const by = bySum / nodesB.length
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
}

// ─── Main function ───────────────────────────────────────────────────

export function computeClusters(
  nodes: NodePosition[],
  edges: EdgeInfo[],
  gridSize: number = 400
): Cluster[] {
  if (nodes.length === 0) return []

  // Build lookup
  const nodesById = new Map<string, NodePosition>()
  for (const node of nodes) {
    nodesById.set(node.id, node)
  }

  // ─── Pass 1: Grid bucketing (O(n)) ─────────────────────────────

  // Map: grid key → list of node ids
  const gridCells = new Map<string, string[]>()
  // Map: node id → grid key
  const nodeToCell = new Map<string, string>()

  for (const node of nodes) {
    const gx = Math.floor(node.x / gridSize)
    const gy = Math.floor(node.y / gridSize)
    const key = gridKey(gx, gy)
    if (!gridCells.has(key)) {
      gridCells.set(key, [])
    }
    gridCells.get(key)!.push(node.id)
    nodeToCell.set(node.id, key)
  }

  // Only cells with 2+ nodes are candidate clusters
  const candidateCells = new Set<string>()
  for (const [key, cellNodeIds] of gridCells) {
    if (cellNodeIds.length >= 2) {
      candidateCells.add(key)
    }
  }

  // Straggler absorption: nodes in singleton cells that have edges to candidate
  // cells get absorbed into the nearest adjacent candidate cell. This improves
  // MAUP resistance — a translation that moves one node across a grid boundary
  // doesn't orphan it from its group.
  for (const edge of edges) {
    const cellA = nodeToCell.get(edge.source)
    const cellB = nodeToCell.get(edge.target)
    if (!cellA || !cellB || cellA === cellB) continue

    // If one cell is a candidate and the other is not, and they're adjacent,
    // absorb the non-candidate's nodes into the candidate cell
    if (candidateCells.has(cellA) && !candidateCells.has(cellB) && areAdjacent(cellA, cellB)) {
      // Move all nodes from cellB into cellA
      const stragglers = gridCells.get(cellB)!
      for (const nid of stragglers) {
        nodeToCell.set(nid, cellA)
        gridCells.get(cellA)!.push(nid)
      }
      gridCells.set(cellB, [])
    } else if (candidateCells.has(cellB) && !candidateCells.has(cellA) && areAdjacent(cellA, cellB)) {
      const stragglers = gridCells.get(cellA)!
      for (const nid of stragglers) {
        nodeToCell.set(nid, cellB)
        gridCells.get(cellB)!.push(nid)
      }
      gridCells.set(cellA, [])
    }
  }

  // If no candidate cells, return empty
  if (candidateCells.size === 0) return []

  // ─── Pass 2: Edge-informed merge (O(e)) ─────────────────────────

  const uf = new UnionFind()
  for (const key of candidateCells) {
    uf.makeSet(key)
  }

  for (const edge of edges) {
    const cellA = nodeToCell.get(edge.source)
    const cellB = nodeToCell.get(edge.target)
    if (
      cellA &&
      cellB &&
      cellA !== cellB &&
      candidateCells.has(cellA) &&
      candidateCells.has(cellB) &&
      areAdjacent(cellA, cellB)
    ) {
      uf.union(cellA, cellB)
    }
  }

  // Build merged clusters: union-find root → list of cell keys
  const cellGroups = uf.getGroups()

  // Now collect node IDs per cluster group
  let clusterNodeLists: string[][] = []
  for (const cellKeys of cellGroups.values()) {
    const nodeIds: string[] = []
    for (const key of cellKeys) {
      nodeIds.push(...gridCells.get(key)!)
    }
    clusterNodeLists.push(nodeIds)
  }

  // ─── Pass 3: PFD constraint enforcement (O(c)) ─────────────────

  // Upper bound: merge down to <= 8
  while (clusterNodeLists.length > 8) {
    // Find the two closest clusters by centroid distance
    let minDist = Infinity
    let mergeI = 0
    let mergeJ = 1
    for (let i = 0; i < clusterNodeLists.length; i++) {
      for (let j = i + 1; j < clusterNodeLists.length; j++) {
        const d = centroidDistance(clusterNodeLists[i], clusterNodeLists[j], nodesById)
        if (d < minDist) {
          minDist = d
          mergeI = i
          mergeJ = j
        }
      }
    }
    // Merge j into i
    clusterNodeLists[mergeI] = [
      ...clusterNodeLists[mergeI],
      ...clusterNodeLists[mergeJ]
    ]
    clusterNodeLists.splice(mergeJ, 1)
  }

  // Lower bound: split up to >= 4
  while (clusterNodeLists.length < 4) {
    // Find the largest cluster that can be split (has >= 4 nodes so each half gets >= 2)
    let largestIdx = -1
    let largestSize = 0
    for (let i = 0; i < clusterNodeLists.length; i++) {
      if (clusterNodeLists[i].length >= 4 && clusterNodeLists[i].length > largestSize) {
        largestSize = clusterNodeLists[i].length
        largestIdx = i
      }
    }

    if (largestIdx === -1) break // Can't split anything

    // Split by position median on longest axis
    const clusterNodes = clusterNodeLists[largestIdx].map((id) => nodesById.get(id)!)
    const xs = clusterNodes.map((n) => n.x)
    const ys = clusterNodes.map((n) => n.y)
    const xRange = Math.max(...xs) - Math.min(...xs)
    const yRange = Math.max(...ys) - Math.min(...ys)

    // Sort by longest axis
    const sortedIds = [...clusterNodeLists[largestIdx]]
    if (xRange >= yRange) {
      sortedIds.sort((a, b) => nodesById.get(a)!.x - nodesById.get(b)!.x)
    } else {
      sortedIds.sort((a, b) => nodesById.get(a)!.y - nodesById.get(b)!.y)
    }

    const mid = Math.floor(sortedIds.length / 2)
    const half1 = sortedIds.slice(0, mid)
    const half2 = sortedIds.slice(mid)

    // Only split if both halves have >= 2 nodes
    if (half1.length >= 2 && half2.length >= 2) {
      clusterNodeLists[largestIdx] = half1
      clusterNodeLists.push(half2)
    } else {
      break // Can't produce valid split
    }
  }

  // ─── Build output clusters ─────────────────────────────────────

  const result: Cluster[] = []
  for (let i = 0; i < clusterNodeLists.length; i++) {
    const nodeIds = clusterNodeLists[i]
    const metadata = computeClusterMetadata(nodeIds, nodesById)

    // Generate a stable ID based on the sorted node IDs in this cluster
    // Use the grid coordinates of the centroid for readability
    const gx = Math.floor(metadata.centroid.x / gridSize)
    const gy = Math.floor(metadata.centroid.y / gridSize)
    const id = `cluster-${gx}-${gy}`

    // Deduplicate IDs if needed by appending index
    const existingIds = result.map((r) => r.id)
    const finalId = existingIds.includes(id) ? `${id}-${i}` : id

    result.push({
      id: finalId,
      nodeIds,
      centroid: metadata.centroid,
      bounds: metadata.bounds,
      dominantType: metadata.dominantType,
      summary: metadata.summary
    })
  }

  return result
}
