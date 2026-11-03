import Konva from "konva";

export type RoomId = "room_a" | "room_b" | "room_c" | "room_X" | "vault";

interface MapOptions {
  container: HTMLDivElement;
  onEnterRoom: (room: RoomId) => void;
  money?: number;
  progress?: number; // connect to timer
  lockedRooms?: RoomId[];
}

export function createMapScreen(options: MapOptions) {
  const WIDTH = 1440;
  const HEIGHT = 900;

  const colors = {
    background: "#202543",
    room: "#d9d9d9",
    locked: "#5b5b5b",
    purple: "#342657",
    button: "#f4f4f4",
    gold: "#ffd447",
    green: "#81ff38",
  };

  const stage = new Konva.Stage({
    container: options.container,
    width: WIDTH,
    height: HEIGHT,
  });

  const layer = new Konva.Layer();
  const scene = new Konva.Group();
  stage.add(layer);
  layer.add(scene);

  const locked = new Set<RoomId>(
    options.lockedRooms ?? ["room_c", "vault"],
  );

  function rect(config: Konva.RectConfig) {
    const node = new Konva.Rect(config);
    scene.add(node);
    return node;
  }

  function text(config: Konva.TextConfig) {
    const node = new Konva.Text({
      fontFamily: "Fredoka, sans-serif",
      fontSize: 24,
      fontStyle: "600",
      fill: colors.purple,
      ...config,
    });
    scene.add(node);
    return node;
  }

  rect({
    width: WIDTH,
    height: HEIGHT,
    fill: colors.background,
    listening: false,
  });

  // Corridor / overall floor plan.
  rect({
    x: 116, y: 81, width: 1207, height: 737,
    fill: "rgba(217,217,217,0.5)",
    stroke: "black", strokeWidth: 3,
    listening: false,
  });

  const rooms: {
    id: RoomId;
    label: string;
    bounds: [number, number, number, number];
    button: [number, number];
    lock?: [number, number];
  }[] = [
    {
      id: "room_a", label: "ROOM A",
      bounds: [116, 81, 368, 275],
      button: [204, 198],
    },
    {
      id: "room_b", label: "ROOM B",
      bounds: [484, 81, 366, 275],
      button: [573, 198],
    },
    {
      id: "room_c", label: "ROOM C",
      bounds: [116, 524, 734, 294],
      button: [388, 661],
      lock: [137, 544],
    },
    {
      id: "vault", label: "VAULT",
      bounds: [1029, 81, 293, 443],
      button: [1080, 281],
      lock: [1051, 105],
    },
    {
      id: "room_X", label: "ROOM X",
      bounds: [1029, 521, 294, 297],
      button: [1080, 653],
    },
  ];

  // Draw floor geometry before controls.
  const floors = new Map<RoomId, Konva.Rect>();
  for (const room of rooms) {
    const [x, y, width, height] = room.bounds;
    floors.set(room.id, rect({
      x, y, width, height,
      fill: locked.has(room.id) ? colors.locked : colors.room,
      stroke: "black",
      strokeWidth: 3,
      listening: false,
    }));
  }

  const player = new Konva.Circle({
    x: 939.5, y: 773.5, radius: 18.5,
    fill: "#ff0404",
    stroke: "black",
    strokeWidth: 3,
    listening: false,
  });
  scene.add(player);

  const buttons = new Map<RoomId, Konva.Rect>();
  const locks = new Map<RoomId, Konva.Group>();

  for (const room of rooms) {
    if (room.lock) {
      const icon = new Konva.Group({
        x: room.lock[0],
        y: room.lock[1],
        visible: locked.has(room.id),
        listening: false,
      });

      icon.add(new Konva.Path({
        data: "M7 14V9a8 8 0 0 1 16 0v5",
        stroke: "white",
        strokeWidth: 1,
      }));
      icon.add(new Konva.Rect({
        x: 0, y: 14, width: 31, height: 20,
        cornerRadius: 2,
        stroke: "white", strokeWidth: 1,
      }));
      icon.add(new Konva.Circle({
        x: 15.5, y: 22, radius: 2,
        stroke: "white", strokeWidth: 1,
      }));
      icon.add(new Konva.Line({
        points: [15.5, 24, 15.5, 28],
        stroke: "white", strokeWidth: 1,
      }));

      locks.set(room.id, icon);
      scene.add(icon);
    }

    const button = new Konva.Group({
      x: room.button[0], y: room.button[1],
    });

    // Small solid offset under the pill, as in the design.
    button.add(new Konva.Rect({
      y: 4, width: 191, height: 43,
      cornerRadius: 24,
      fill: colors.purple,
      listening: false,
    }));

    const face = new Konva.Rect({
      width: 191, height: 43,
      cornerRadius: 24,
      stroke: colors.purple, strokeWidth: 3,
      fill: locked.has(room.id)
        ? "rgba(244,244,244,0.5)"
        : colors.button,
    });
    buttons.set(room.id, face);
    button.add(face);

    if (room.id === "vault") {
      button.add(new Konva.Star({
        x: 49.5, y: 21.5,
        numPoints: 5, innerRadius: 4, outerRadius: 9,
        fill: colors.purple,
        listening: false,
      }));
    }

    button.add(new Konva.Text({
      x: room.id === "vault" ? 66 : 0,
      width: room.id === "vault" ? 101 : 191,
      height: 43,
      text: room.label,
      align: "center",
      verticalAlign: "middle",
      fontFamily: "Fredoka, sans-serif",
      fontStyle: "600",
      fontSize: 24,
      fill: colors.purple,
      listening: false,
    }));

    button.on("mouseenter", () => {
      stage.container().style.cursor = "pointer";
    });
    button.on("mouseleave", () => {
      stage.container().style.cursor = "";
    });
    button.on("click tap", () => {
      tooltip.visible(false);

      // MapController decides whether entry is allowed
      options.onEnterRoom(room.id);

      layer.batchDraw();
    });

    scene.add(button);
  }

  // Currency
  rect({
    x: 20, y: 22, width: 59, height: 43,
    cornerRadius: 24,
    stroke: colors.gold, strokeWidth: 3,
    listening: false,
  });
  const moneyLabel = text({
    x: 20, y: 22, width: 59, height: 43,
    text: `$${options.money ?? 0}`,
    align: "center",
    verticalAlign: "middle",
    fill: colors.gold,
    listening: false,
  });

  // Timer bar
  rect({
    x: 204, y: 15, width: 970, height: 50,
    cornerRadius: 50,
    fill: colors.background,
    stroke: "black", strokeWidth: 3,
    listening: false,
  });

  const barClip = new Konva.Group({
    clipX: 204, clipY: 15, clipWidth: 970, clipHeight: 50,
    listening: false,
  });
  const bar = new Konva.Rect({
    x: 204, y: 15, width: 970, height: 50,
    cornerRadius: 50,
    fill: colors.green,
  });
  barClip.add(bar);
  scene.add(barClip);

  rect({
    x: 204, y: 15, width: 970, height: 50,
    cornerRadius: 50,
    stroke: "black", strokeWidth: 3,
    listening: false,
  });

  const tooltip = new Konva.Group({
  visible: false,
  listening: false,
});

const tooltipBackground = new Konva.Rect({
  width: 260,
  height: 58,
  fill: "white",
  cornerRadius: 15,
});

const tooltipText = new Konva.Text({
  x: 12,
  y: 10,
  width: 236,
  text: "",
  fontFamily: "Freeman, sans-serif",
  fontSize: 16,
  lineHeight: 1.25,
  fill: colors.purple,
});

tooltip.add(tooltipBackground, tooltipText);
scene.add(tooltip);

  function setProgress(value: number) {
    const progress = Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : 0;
    barClip.clipWidth(970 * progress);
    layer.batchDraw();
  }

  function resize() {
    const { width, height } = options.container.getBoundingClientRect();
    if (!width || !height) return;

    const scale = Math.min(width / WIDTH, height / HEIGHT);
    stage.size({ width, height });
    scene.scale({ x: scale, y: scale });
    scene.position({
      x: (width - WIDTH * scale) / 2,
      y: (height - HEIGHT * scale) / 2,
    });
    layer.batchDraw();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(options.container);
  stage.container().style.background = colors.background;
  setProgress(options.progress ?? 1);
  resize();

  return {
    setMoney(value: number) {
      moneyLabel.text(`$${value}`);
      layer.batchDraw();
    },
    setProgress,
    setPlayerPosition(x: number, y: number) {
      player.position({ x, y });
      layer.batchDraw();
    },
    setRoomLocked(id: RoomId, isLocked: boolean) {
      if (isLocked) locked.add(id);
      else locked.delete(id);

      floors.get(id)?.fill(isLocked ? colors.locked : colors.room);
      buttons.get(id)?.fill(
        isLocked ? "rgba(244,244,244,0.5)" : colors.button,
      );
      locks.get(id)?.visible(isLocked);
      tooltip.visible(false);
      layer.batchDraw();
    },
    showAccessDenied(roomId: RoomId, message: string) {
        const room = rooms.find((room) => room.id === roomId);
        if (!room) return;

        tooltipText.text(message);

        const height = tooltipText.height() + 20;
        tooltipBackground.height(height);

        const [anchorX, anchorY] = room.lock ?? room.button;

        tooltip.position({
            x: Math.max(0, Math.min(anchorX + 52, WIDTH - 272)),
            y: Math.max(0, Math.min(anchorY + 8, HEIGHT - height - 12)),
        });

        tooltip.visible(true);
        tooltip.moveToTop();
        layer.batchDraw();
    },
    hideAccessDenied() {
        tooltip.visible(false);
        layer.batchDraw();
    },
    destroy() {
      observer.disconnect();
      stage.container().style.cursor = "";
      stage.destroy();
    },
  };
}