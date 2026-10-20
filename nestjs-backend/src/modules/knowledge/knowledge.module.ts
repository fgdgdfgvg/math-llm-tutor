import { Module, forwardRef } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { Neo4jService } from './neo4j/neo4j.service';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgePointMappingService } from './knowledge-point-mapping.service';
import { LearningModule } from '../learning/learning.module';

@Module({
  // LearningModule → StudentModule → KnowledgeModule 构成模块环，需要 forwardRef
  imports: [forwardRef(() => LearningModule)],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    Neo4jService,
    KnowledgeGraphService,
    KnowledgePointMappingService,
  ],
  exports: [
    KnowledgeService,
    Neo4jService,
    KnowledgeGraphService,
    KnowledgePointMappingService,
  ],
})
export class KnowledgeModule {}
