import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import type {
  KnowledgeNode,
  KnowledgeRelation,
  LearningPath,
} from './interfaces/knowledge.interfaces';

interface SearchResult {
  name: string;
  type: string;
  description: string;
  score: number;
  relatedCount: number;
  difficulty: string;
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('concepts')
  async getAllConcepts(): Promise<KnowledgeNode[]> {
    return this.knowledgeService.getAllConcepts();
  }

  @Get('concepts/:id')
  async getConcept(@Param('id') id: string): Promise<KnowledgeNode | null> {
    return this.knowledgeService.getConcept(id);
  }

  @Get('concepts/:id/prerequisites')
  async getPrerequisites(@Param('id') id: string): Promise<KnowledgeNode[]> {
    return this.knowledgeService.getPrerequisites(id);
  }

  @Get('concepts/:id/dependents')
  async getDependentConcepts(
    @Param('id') id: string,
  ): Promise<KnowledgeNode[]> {
    return this.knowledgeService.getDependentConcepts(id);
  }

  @Get('concepts/:id/related')
  async getRelatedConcepts(@Param('id') id: string): Promise<KnowledgeNode[]> {
    return this.knowledgeService.getRelatedConcepts(id);
  }

  @Get('concepts/:id/learning-path')
  async getLearningPath(@Param('id') id: string): Promise<LearningPath> {
    return this.knowledgeService.getLearningPath(id);
  }

  @Get('search')
  async searchConcepts(@Query('q') query: string): Promise<SearchResult[]> {
    return this.knowledgeService.searchConcepts(query);
  }

  @Get('tags/:tag')
  async getConceptsByTag(@Param('tag') tag: string): Promise<KnowledgeNode[]> {
    return this.knowledgeService.getConceptsByTag(tag);
  }

  @Get('common-mistakes')
  async getCommonMistakes(
    @Query('q') query: string,
  ): Promise<{ mistake: string; tip: string }[]> {
    return this.knowledgeService.getCommonMistakes(query);
  }

  @Get('difficulty/:level')
  async getConceptsByDifficulty(
    @Param('level') level: 'easy' | 'medium' | 'hard',
  ): Promise<KnowledgeNode[]> {
    return this.knowledgeService.getConceptsByDifficulty(level);
  }

  @Get('graph')
  async getKnowledgeGraph(): Promise<{
    nodes: KnowledgeNode[];
    edges: KnowledgeRelation[];
  }> {
    return this.knowledgeService.getKnowledgeGraph();
  }

  @Get('status')
  async getStatus(): Promise<{ usingFallback: boolean; nodeCount: number }> {
    const graph = await this.knowledgeService.getKnowledgeGraph();
    return {
      usingFallback: this.knowledgeService.isUsingFallback(),
      nodeCount: graph.nodes.length,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('concepts')
  async createConcept(
    @Body() concept: Partial<KnowledgeNode>,
  ): Promise<KnowledgeNode> {
    return this.knowledgeService.createConcept(concept);
  }

  @UseGuards(JwtAuthGuard)
  @Post('relations')
  async createRelation(
    @Body() relation: KnowledgeRelation,
  ): Promise<{ success: boolean }> {
    await this.knowledgeService.createRelation(relation);
    return { success: true };
  }
}
