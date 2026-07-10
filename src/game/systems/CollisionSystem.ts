import Phaser from 'phaser';

import type { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';
import type { RecoveryItem } from '../entities/RecoveryItem';

export class CollisionSystem {
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    obstacleGroup: Phaser.Physics.Arcade.Group,
    itemGroup: Phaser.Physics.Arcade.Group,
    onObstacleHit: (obstacle: Obstacle) => void,
    onItemCollected: (item: RecoveryItem) => void,
  ) {
    this.colliders.push(
      scene.physics.add.overlap(player, obstacleGroup, (_player, obstacle) => {
        onObstacleHit(obstacle as Obstacle);
      }),
      scene.physics.add.overlap(player, itemGroup, (_player, item) => {
        onItemCollected(item as RecoveryItem);
      }),
    );

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  public destroy(): void {
    for (const collider of this.colliders) collider.destroy();
    this.colliders.length = 0;
  }
}
