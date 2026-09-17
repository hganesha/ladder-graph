import { BaseEdge, type EdgeProps, Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { type CSSProperties, memo, type ReactNode } from "react";
import { NODE_META } from "../lib/nodeMeta";
import { resolveAgentIcon } from "../lib/nodeIcons";
import { ISO_TILE, isoEdgePath } from "../lib/projection";
import { type GroupFlowData, type GroupFlowNode, GroupNode } from "./GroupNode";
import { InlineNodeField } from "./InlineNodeField";
import { NodeIcon } from "./NodeIcon";
import { hasIncompleteConfig, TASK_NODE_ICONS, type TaskFlowData } from "./TaskNode";

export type IsoTaskFlowNode = Node<TaskFlowData, "isoTask">;
export type IsoGroupFlowData = GroupFlowData & { plane: { width: number; height: number; transform: string } };
export type IsoGroupFlowNode = Node<IsoGroupFlowData, "isoGroup">;

// Tile geometry, in the tile's own box, around the floor center (ISO_TILE.anchorX, anchorY).
const ax = ISO_TILE.anchorX;
const ay = ISO_TILE.anchorY;
const diamond = (halfWidth: number, rise = 0) => {
  const halfHeight = halfWidth * Math.tan(Math.PI / 6);
  return {
    top: [ax, ay - halfHeight - rise],
    right: [ax + halfWidth, ay - rise],
    bottom: [ax, ay + halfHeight - rise],
    left: [ax - halfWidth, ay - rise],
  };
};
const points = (...corners: number[][]) => corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const platform = diamond(52);
const platformBase = diamond(52, -8);
const ring = diamond(66);
const blockBase = diamond(30);
const blockTop = diamond(30, 28);
// Handles sit on the midpoints of the platform faces that point along the flat x axis.
const targetHandle = { left: (platform.top[0] + platform.left[0]) / 2, top: (platform.top[1] + platform.left[1]) / 2 };
const sourceHandle = { left: (platform.right[0] + platform.bottom[0]) / 2, top: (platform.right[1] + platform.bottom[1]) / 2 };

/** An upright isometric block on a floor platform, with an icon badge and a label underneath. */
export function IsoTile({
  alert,
  ariaLabel,
  className = "",
  color,
  handleClassName,
  icon,
  kicker,
  name,
  selected,
  title,
}: {
  alert?: ReactNode;
  ariaLabel: string;
  className?: string;
  color: string;
  handleClassName: string;
  icon: ReactNode;
  kicker: string;
  name: ReactNode;
  selected: boolean;
  title?: string;
}) {
  return (
    <article
      className={`iso-task-node ${selected ? "selected" : ""} ${className}`}
      style={{ "--node-color": color, width: ISO_TILE.width, height: ISO_TILE.height } as CSSProperties}
      aria-label={ariaLabel}
      title={title}
    >
      <Handle type="target" position={Position.Left} className={handleClassName} style={targetHandle} />
      <svg aria-hidden="true" className="iso-tile" width={ISO_TILE.width} height={ISO_TILE.height}>
        <ellipse className="iso-shadow" cx={ax} cy={ay + 16} rx="62" ry="22" />
        {selected && <polygon className="iso-ring" points={points(ring.top, ring.right, ring.bottom, ring.left)} />}
        <polygon className="iso-platform-side" points={points(platform.left, platform.bottom, platformBase.bottom, platformBase.left)} />
        <polygon
          className="iso-platform-side shade"
          points={points(platform.bottom, platform.right, platformBase.right, platformBase.bottom)}
        />
        <polygon className="iso-platform" points={points(platform.top, platform.right, platform.bottom, platform.left)} />
        <polygon className="iso-block-left" points={points(blockTop.left, blockTop.bottom, blockBase.bottom, blockBase.left)} />
        <polygon className="iso-block-right" points={points(blockTop.bottom, blockTop.right, blockBase.right, blockBase.bottom)} />
        <polygon className="iso-block-top" points={points(blockTop.top, blockTop.right, blockTop.bottom, blockTop.left)} />
      </svg>
      <span className="iso-node-badge">
        {icon}
        {alert}
      </span>
      <div className="iso-node-label">
        <span>{kicker}</span>
        {name}
      </div>
      <Handle type="source" position={Position.Right} className={handleClassName} style={sourceHandle} />
    </article>
  );
}

export const IsometricTaskNode = memo(function IsometricTaskNode({ data, selected }: NodeProps<IsoTaskFlowNode>) {
  const meta = NODE_META[data.kind];
  const Icon = TASK_NODE_ICONS[data.kind];
  const agentIcon = data.kind === "agent" ? resolveAgentIcon(data) : undefined;
  return (
    <IsoTile
      alert={hasIncompleteConfig(data) && <AlertTriangle size={11} className="node-alert" aria-label="Incomplete configuration" />}
      ariaLabel={`${meta.label}: ${data.name}`}
      color={meta.color}
      handleClassName="node-handle"
      icon={agentIcon ? <NodeIcon name={agentIcon.name} size={14} /> : <Icon aria-hidden="true" size={14} />}
      kicker={meta.label}
      name={
        <InlineNodeField
          as="h3"
          editable={Boolean(data.onInlineEdit)}
          label="node name"
          onCommit={(name) => data.onInlineEdit?.(data.id, { name })}
          placeholder="Untitled node"
          showAffordance={selected}
          value={data.name}
        />
      }
      selected={selected}
      title={data.summary || meta.hint}
    />
  );
});

/** Lays the flat group card on the isometric floor plane so members and handles stay in their familiar places. */
export const IsometricGroupNode = memo(function IsometricGroupNode(props: NodeProps<IsoGroupFlowNode>) {
  const { plane } = props.data;
  return (
    <div className="iso-group-node">
      <div className="iso-group-plane" style={{ width: plane.width, height: plane.height, transform: plane.transform }}>
        <GroupNode {...(props as unknown as NodeProps<GroupFlowNode>)} />
      </div>
    </div>
  );
});

export function IsometricEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  markerStart,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}: EdgeProps) {
  const { path, labelX, labelY } = isoEdgePath({ x: sourceX, y: sourceY }, { x: targetX, y: targetY });
  return (
    <BaseEdge
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      interactionWidth={interactionWidth}
      markerEnd={markerEnd}
      markerStart={markerStart}
      style={{ ...style, strokeLinejoin: "round" }}
    />
  );
}
