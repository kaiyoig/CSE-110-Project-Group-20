import Konva from 'konva';
import type { GraphEntry } from './graph-match-model';
import { formatGraphEquation } from './graph';

export interface LaserMatchViewOptions {
  layer: Konva.Layer;
  x: number;
  y: number;
  width: number;
  height: number;
  panelColor?: string;
}

interface EquationRow {
  equation: string;
  text: Konva.Text;
  card: Konva.Group;
  screen: Konva.Rect;
  statusLabel: Konva.Text;
  matched: boolean;
}

interface GraphRow {
  index: number;
  graph: Konva.Group;
  card: Konva.Group;
  screen: Konva.Rect;
  matched: boolean;
}

class LaserMatchView {
  private readonly options: LaserMatchViewOptions;
  private readonly root: Konva.Group;
  private readonly equationRows: EquationRow[] = [];
  private readonly graphRows: GraphRow[] = [];
  private selectedEquation?: EquationRow;
  private selectedGraph?: GraphRow;
  private pendingMatch?: { equation: string; graph: number };
  private laser?: Konva.Line;
  private readonly laserIndicators: Konva.Rect[] = [];
  private readonly laserStatusLabels: Konva.Text[] = [];
  private readonly laserStatusBoxes: Konva.Rect[] = [];
  private activeLaserLabel?: Konva.Text;
  
  private disabledLaserCount = 0;

  /** Called with an equation and model graph index whenever a pair is selected. */
  public onMatch?: (equation: string, graph: number) => void;
  /** Called after a correct pair has completed its laser animation. */
  public onSolved?: (equation: string) => void;

  /** Builds the panel, equation rows, shuffled graph rows, and controls. */
  public constructor(options: LaserMatchViewOptions, entries: GraphEntry[]) {
    this.options = {
      ...options,
      height: Math.max(options.height, 550),
    };
    this.root = new Konva.Group({
      x: options.x - options.width / 2,
      y: options.y - options.height / 2,
    });
    options.layer.add(this.root);
    this.root.add(new Konva.Rect({
      width: options.width,
      height: this.options.height,
      fill: '#b3bcc7',
      stroke: '#535e6d',
      strokeWidth: 4,
      cornerRadius: 12,
    }));

    // dark header
    this.root.add(new Konva.Rect({
      x: 12,
      y: 12,
      width: options.width - 24,
      height: 46,
      fill: '#303946',
      cornerRadius: 8,
    }));

    // yellow caution accent
    this.root.add(new Konva.Rect({
      x: 25,
      y: 22,
      width: 12,
      height: 27,
      fill: '#f5c934',
      stroke: '#282b30',
      strokeWidth: 2,
    }));

    // header title
    this.root.add(new Konva.Text({
      x: 50,
      y: 21,
      width: options.width - 100,
      text: 'LASER CONTROL',
      fontSize: 24,
      fontStyle: 'bold',
      fill: '#fff0c3',
    }));

    // laser security display
      this.root.add(new Konva.Rect({
      x: 18,
      y: 66,
      width: options.width - 36,
      height: 102,
      fill: '#1b2432',
      stroke: '#4b6881',
      strokeWidth: 3,
      cornerRadius: 9,
    }));

    // Status heading
    this.root.add(new Konva.Text({
      x: 32,
      y: 74,
      text: 'Laser status',
      fontSize: 16,
      fontStyle: 'bold',
      fill: '#e2e8f0',
    }));

    const laserCount = entries.length;
    this.activeLaserLabel = new Konva.Text({
      x: options.width - 140,
      y: 74,
      width: 108,
      text: `${laserCount} active`,
      fontSize: 15,
      fontStyle: 'bold',
      fill: '#ff8195',
      align: 'right',
    });
    this.root.add(this.activeLaserLabel);
    const gap = 10;
    const availableWidth = options.width - 64;
    const laserWidth =
      (availableWidth - gap * (laserCount - 1)) / laserCount;

    for (let i = 0; i < laserCount; i++) {
      const x = 32 + i * (laserWidth + gap);

      // individual laser status box
      const statusBox = new Konva.Rect({
        x,
        y: 99,
        width: laserWidth,
        height: 58,
        fill: '#432b36',
        stroke: '#76414d',
        strokeWidth: 1,
        cornerRadius: 8,
      });

      this.laserStatusBoxes.push(statusBox);
      this.root.add(statusBox);

      // laser number
      this.root.add(new Konva.Text({
        x: x + 12,
        y: 109,
        text: String(i + 1).padStart(2, '0'),
        fontSize: 14,
        fontStyle: 'bold',
        fill: '#ffacbc',
      }));

      // ON status
      
      const statusLabel = new Konva.Text({
        x: x + laserWidth - 50,
        y: 109,
        text: 'ON',
        fontSize: 14,
        fontStyle: 'bold',
        fill: '#ffacbc',
      });

      this.laserStatusLabels.push(statusLabel);
      this.root.add(statusLabel);


      // glowing laser bar
      const laser = new Konva.Rect({
        x: x + 12,
        y: 140,
        width: laserWidth - 24,
        height: 8,
        fill: '#fb4760',
        cornerRadius: 4,
        shadowColor: '#fb4760',
        shadowBlur: 12,
        shadowOpacity: 0.8,
      });

      this.laserIndicators.push(laser);
      this.root.add(laser);
    }

      this.root.add(new Konva.Text({
        x: 24,
        y: 178,
        width: options.width - 48,
        text: 'Select an equation, then its matching graph',
        fontSize: 16,
        fill: '#303946',
        align: 'center',
      }));

      this.createRows(entries);
  }

  private createRows(entries: GraphEntry[]): void {
    const topPadding = 202;
    const bottomPadding = 15;
    const sidePadding = 18;
    const columnGap = 18;
    const cardWidth =
      (this.options.width - sidePadding * 2 - columnGap) / 2;
    const cardHeight = 100;
    const rowHeight =
    (this.options.height - topPadding - bottomPadding) /
    Math.max(entries.length, 1);
    const graphEntries = [...entries].sort(() => Math.random() - 0.5);
    entries.forEach(([equation], index) => {
      const y = topPadding + rowHeight * index + rowHeight / 2;

      //container for the equation card
      const card = new Konva.Group({
        x: sidePadding,
        y: y - cardHeight / 2,
      });

      //blue screen background
      const screen = new Konva.Rect({
        width: cardWidth,
        height: cardHeight,
        fill: '#102b43',
        stroke: '#4b6881',
        strokeWidth: 3,
        cornerRadius: 8,
      });

      card.add(screen);

      //equation text inside the screen
      const text = new Konva.Text({
        text: formatGraphEquation(equation),
        x: 16,
        y: 30,
        width: cardWidth - 32,
        fontSize: 26,
        fill: '#a8e8ff',
        align: 'left',
      });

      card.add(text);

      
      const statusLabel = new Konva.Text({
        x: 16,
        y: 74,
        text: 'SELECT',
        fontSize: 13,
        fontStyle: 'bold',
        fill: '#a8b9cb',
      });

      card.add(statusLabel);


      const row: EquationRow = {
        equation,
        text,
        card,
        screen,
        statusLabel,
        matched: false,
      };

      card.on('click tap', () => {
        if (row.matched) return;
        this.selectEquation(row);
      });

      card.on('mouseenter', () => {
        if (row.matched) return;
        const container = card.getStage()?.container();
        if (container) container.style.cursor = 'pointer';

        screen.to({
            fill: '#163b56',
            duration: 0.12,
        });

        card.to({
          scaleX: 1.03,
          scaleY: 1.03,
          duration: 0.15,
          easing: Konva.Easings.EaseOut,
        });
        
      });

    card.on('mouseleave', () => {
      if (row.matched) return;
      const container = card.getStage()?.container();
      if (container) container.style.cursor = 'default';

      screen.to({
        fill: '#102b43',
        duration: 0.12,
      });

      card.to({
        scaleX: 1,
        scaleY: 1,
        duration: 0.15,
        easing: Konva.Easings.EaseOut,
      });
    });

    

      this.equationRows.push(row);
      this.root.add(card);
    });

    graphEntries.forEach(([_, graph], index) => {
    const y = topPadding + rowHeight * index + rowHeight / 2;

    // group for the entire graph card
    const card = new Konva.Group({
      x: sidePadding + cardWidth + columnGap,
      y: y - cardHeight / 2,
    });

    // blue background
    const screen = new Konva.Rect({
      width: cardWidth,
      height: cardHeight,
      fill: '#102b43',
      stroke: '#4b6881',
      strokeWidth: 3,
      cornerRadius: 8,
    });

    card.add(screen);

    // position the existing graph inside the card
    graph.scale({ x: 0.6, y: 0.6 });

    graph.position({
      x: cardWidth / 2,
      y: cardHeight / 2 + 8,
    });

    // recolor graph axes and labels to match blue screen
    graph.find<Konva.Line>('Line').forEach(line => {
      if (line.stroke() === '#66aa33') {
        line.stroke('#7197b1');
      }
    });

    graph.find<Konva.Text>('Text').forEach(text => {
      text.fill('#a8e8ff');
    });

    card.add(graph);

    const row: GraphRow = {
      index: entries.findIndex(entry => entry[1] === graph),
      graph,
      card,
      screen,
      matched: false,
    };

    graph.setAttr('graphIndex', row.index);

    card.on('click tap', () => {
      if (row.matched) return;
      this.selectGraph(row);
    });

      card.on('mouseenter', () => {
        if (row.matched) return;

         const container = card.getStage()?.container();
        if (container) container.style.cursor = 'pointer';

        screen.to({
            fill: '#163b56',
            duration: 0.12,
        });

        card.to({
          scaleX: 1.03,
          scaleY: 1.03,
          duration: 0.15,
          easing: Konva.Easings.EaseOut,
        });
      });

    card.on('mouseleave', () => {
      if (row.matched) return;
      
      const container = card.getStage()?.container();
      if (container) container.style.cursor = 'default';  

      screen.to({
        fill: '#102b43',
        duration: 0.12,
      });
      
      card.to({
        scaleX: 1,
        scaleY: 1,
        duration: 0.15,
        easing: Konva.Easings.EaseOut,
      });
    });

    this.graphRows.push(row);
    this.root.add(card);
  
    });
  }

  private selectEquation(row: EquationRow): void {
    if (row.matched) return;
    
    this.selectedEquation?.screen.to({
      stroke: '#4b6881',
      strokeWidth: 3,
      shadowBlur: 0,
      shadowOpacity: 0,
      duration: 0.15,
    });

    if (this.selectedEquation) {
      this.selectedEquation.statusLabel.text('SELECT');
      this.selectedEquation.statusLabel.fill('#a8b9cb');
    }

    this.selectedEquation = row;


    row.statusLabel.text('SELECTED');
    row.statusLabel.fill('#ffd443');


    row.screen.to({
      stroke: '#ffd443',
      strokeWidth: 5,
      shadowColor: '#ffd443',
      shadowBlur: 14,
      shadowOpacity: 0.65,
      duration: 0.15,
    });

    this.tryMatch();
  }

  private selectGraph(row: GraphRow): void {
    if (row.matched) return;
    this.selectedGraph?.screen.to({
      stroke: '#4b6881',
      strokeWidth: 3,
      shadowOpacity: 0,
      shadowBlur: 0,
      duration: 0.15,
    });

    this.selectedGraph = row;

    row.screen.to({
    stroke: '#ffd443',
    strokeWidth: 5,
    shadowColor: '#ffd443',
    shadowBlur: 14,
    shadowOpacity: 0.65,
    duration: 0.15,
    });
    this.tryMatch();
  }

  private tryMatch(): void {
    if (!this.selectedEquation || !this.selectedGraph) return;
    const equation = this.selectedEquation;
    const graph = this.selectedGraph;
    this.selectedEquation = undefined;
    this.selectedGraph = undefined;
    this.pendingMatch = { equation: equation.equation, graph: graph.index };
    this.onMatch?.(equation.equation, graph.index);
  }

  private drawLaser(equation: string, graph: number): Konva.Line | undefined {
    const equationRow = this.equationRows.find(row => row.equation === equation);
    const graphRow = this.graphRows.find(row => row.index === graph);
    if (!equationRow || !graphRow) return undefined;
      const startX = equationRow.card.x() + equationRow.screen.width();
      const startY = equationRow.card.y() + equationRow.screen.height() / 2;

      const endX = graphRow.card.x();
      const endY = graphRow.card.y() + graphRow.screen.height() / 2;
    this.laser?.destroy();
    this.laser = new Konva.Line({
      points: [startX, startY, endX, endY],
      stroke: '#fb4760',
      strokeWidth: 4,
      lineCap: 'round',

      // flowing laser effect
      dash: [24, 6],
      dashOffset: 0,

      // subtle glow
      shadowColor: '#fb4760',
      shadowBlur: 8,
      shadowOpacity: 0.4,

      opacity: 0,
    });

    this.root.add(this.laser);
    return this.laser;
  }

  /** Connects a correct equation/graph pair with a two-blink laser. */
  public solve(equation: string): void {
    const target = this.pendingMatch?.equation === equation
      ? this.pendingMatch.graph
      : this.graphRows.find(row => !row.matched)?.index;
    if (target === undefined) return;
    this.lockPair(equation, target);
    const laser = this.drawLaser(equation, target);
    if (!laser) return;
    laser.to({
      opacity: 1, dashOffset: -30, duration: 0.12, onFinish: () => {
        laser.to({
          opacity: 0, duration: 0.12, onFinish: () => {
            laser.to({
              opacity: 1, duration: 0.12, onFinish: () => {
                laser.to({ opacity: 0, duration: 0.12, onFinish: () => this.finishMatch(equation, target) });
              }
            });
          }
        });
      }
    });
  }


  private shakeCard(card: Konva.Group): void {
    const originalX = card.x();
    const offsets = [-7, 7, -5, 5, 0];

    const shakeStep = (index: number): void => {
      if (index >= offsets.length) return;

      card.to({
        x: originalX + offsets[index],
        duration: 0.045,
        onFinish: () => shakeStep(index + 1),
      });
    };

    shakeStep(0);
  }


  /** Shows a one-blink laser for an incorrect equation/graph pair. */
  public incorrect(equation: string, graph: number): void {
    const equationRow = this.equationRows.find(
      row => row.equation === equation
    );

    const graphRow = this.graphRows.find(
      row => row.index === graph
    );

    if (equationRow) {
      this.shakeCard(equationRow.card);
      equationRow.screen.to({
        stroke: '#fb4760',
        shadowColor: '#fb4760',
        shadowBlur: 14,
        shadowOpacity: 0.8,
        duration: 0.08,
      });
    }

    if (graphRow) {
      this.shakeCard(graphRow.card);
      graphRow.screen.to({
        stroke: '#fb4760',
        shadowColor: '#fb4760',
        shadowBlur: 14,
        shadowOpacity: 0.8,
        duration: 0.08,
      });
    }

    const laser = this.drawLaser(equation, graph);
    if (!laser) return;
    laser.to({
      opacity: 1, dashOffset: -30, duration: 0.12, onFinish: () => {
        laser.to({
          opacity: 0, duration: 0.12, onFinish: () => {
            this.clearSelection(equation, graph);
            laser.destroy();
          }
        });
      }
    });
  }

  /** Stops a correct pair from being picked again while its laser blinks. */
  private lockPair(equation: string, graph: number): void {
    const equationRow = this.equationRows.find(row => row.equation === equation);
    const graphRow = this.graphRows.find(row => row.index === graph);
    
    if (!equationRow || !graphRow) return;
      
    equationRow.matched = true;
    graphRow.matched = true;
    
    equationRow.card.listening(false);
    graphRow.card.listening(false);

  }

  private finishMatch(equation: string, graph: number): void {
    const equationRow = this.equationRows.find(row => row.equation === equation);
    const graphRow = this.graphRows.find(row => row.index === graph);
    if (!equationRow || !graphRow) return;

    equationRow.statusLabel.text('MATCHED');
    equationRow.statusLabel.fill('#d7dfe8');
    // turn completed cards gray
    equationRow.screen.to({
      fill: '#697786',
      stroke: '#74808c',
      scaleX: 1,
      scaleY: 1,
      duration: 0.3,
      strokeWidth: 3,
      shadowBlur: 0,
      shadowOpacity: 0,
    });

    graphRow.screen.to({
      fill: '#697786',
      stroke: '#74808c',
      scaleX: 1,
      scaleY: 1,
      duration: 0.3,
      strokeWidth: 3,
      shadowBlur: 0,
      shadowOpacity: 0,
    });

    // dim the completed cards and reset card size
    equationRow.card.to({
      opacity: 0.6,
      scaleX: 1,
      scaleY: 1,
      duration: 0.3,
    });

    graphRow.card.to({
      opacity: 0.6,
      scaleX: 1,
      scaleY: 1,
      duration: 0.3,
    });

    // select next security laser to disable
    const indicatorIndex =
    this.laserIndicators.length - 1 - this.disabledLaserCount;

    const indicator = this.laserIndicators[indicatorIndex];
    const statusLabel = this.laserStatusLabels[indicatorIndex];
    const statusBox = this.laserStatusBoxes[indicatorIndex];

    this.disabledLaserCount++;

    if (indicator) {
      indicator.to({
        opacity: 0.2,
        duration: 0.1,
        onFinish: () => {
          indicator.to({
            opacity: 1,
            duration: 0.08,
            onFinish: () => {
              indicator.to({
                fill: '#596472',
                shadowBlur: 0,
                shadowOpacity: 0,
                duration: 0.25,
                onFinish: () => {
                  statusLabel?.text('OFF');
                  statusLabel?.fill('#bcc7d2');
                  this.activeLaserLabel?.text(
                    `${this.laserIndicators.length - this.disabledLaserCount} active`
                  );
                  statusBox?.to({
                    fill: '#303b49',
                    stroke: '#536272',
                    duration: 0.25,
                  });

                  this.onSolved?.(equation);
},
              });
            },
          });
        },
      });
    } else {
      this.onSolved?.(equation);
    }
    // remove the temporary laser line
    this.laser?.destroy();
  }

  private clearSelection(equation: string, graph: number): void {
    const equationRow = this.equationRows.find(row => row.equation === equation);
    const graphRow = this.graphRows.find(row => row.index === graph);

    if (equationRow && !equationRow.matched) {

    equationRow.statusLabel.text('SELECT');
    equationRow.statusLabel.fill('#a8b9cb');

      equationRow.screen.to({
            stroke: '#4b6881',
            strokeWidth: 3,
            shadowBlur: 0,
            shadowOpacity: 0,
            duration: 0.15,
          });  
    }

  if (graphRow && !graphRow.matched) {
    graphRow.screen.to({
          stroke: '#4b6881',
          strokeWidth: 3,
          shadowBlur: 0,
          shadowOpacity: 0,
          duration: 0.15,
        });  
  }
  }

  /** Removes the view and its Konva objects from the layer. */
  public destroy(): void {
    this.onMatch = undefined;
    this.onSolved = undefined;
    this.laser?.destroy();
    this.root.destroy();
  }
}

export default LaserMatchView;
