import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecoveryService } from './recovery.service';
import { RecoveryController } from './recovery.controller';
import { HealthController } from '../../health.controller';
import { Neo4jService } from '../../modules/knowledge/neo4j/neo4j.service';
import { User, UserSchema } from '../../modules/user/schemas/user.schema';
import { Question, QuestionSchema } from '../../modules/questions/schemas/question.schema';
import { Mistake, MistakeSchema } from '../../modules/questions/schemas/mistake.schema';
import { KnowledgeModule } from '../../modules/knowledge/knowledge.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Mistake.name, schema: MistakeSchema },
    ]),
    forwardRef(() => KnowledgeModule),
  ],
  controllers: [RecoveryController],
  providers: [RecoveryService, HealthController, Neo4jService],
  exports: [RecoveryService],
})
export class RecoveryModule {}
