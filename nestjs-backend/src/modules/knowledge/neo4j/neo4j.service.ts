import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session, Integer } from 'neo4j-driver';
import type { Record as Neo4jRecord } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver;
  private _isInitialized = false;
  private _configured = true;
  private _authFailed = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const uri = this.configService.get<string>('NEO4J_URI');
    const user = this.configService.get<string>('NEO4J_USER');
    const password = this.configService.get<string>('NEO4J_PASSWORD');

    if (!uri || !user || !password) {
      this.logger.warn(
        'Neo4j 未配置，知识图谱功能将使用内存降级模式。如需启用，请在 .env 中设置 NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD。',
      );
      this._configured = false;
      return;
    }

    try {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        encrypted: false,
        trust: 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES',
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 10000,
      });
      await this.driver.verifyConnectivity();
      this._isInitialized = true;
      this._authFailed = false;
      this.logger.log('Neo4j 连接成功');
    } catch (error: any) {
      const msg: string = error.message || '';
      const isAuthError =
        msg.includes('authentication') ||
        msg.includes('unauthorized') ||
        msg.includes('Unauthorized');
      if (isAuthError) {
        this._authFailed = true;
        this.logger.warn(
          `Neo4j 认证失败: ${msg}. 请检查 .env 中 NEO4J_USER/NEO4J_PASSWORD 是否正确。知识图谱功能将使用内存降级模式。`,
        );
      } else {
        this.logger.warn(
          `Neo4j 连接失败: ${msg}. 知识图谱功能将使用内存降级模式。`,
        );
      }
      this._isInitialized = false;
    }
  }

  async onModuleDestroy() {
    if (this.driver) {
      await this.driver.close();
      this.logger.log('Neo4j connection closed');
    }
  }

  isInitialized(): boolean {
    return this._isInitialized && !!this.driver;
  }

  isConfigured(): boolean {
    return this._configured;
  }

  isAuthFailed(): boolean {
    return this._authFailed;
  }

  getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized');
    }
    return this.driver.session();
  }

  async runQuery<T = any>(
    query: string,
    params: Record<string, any> = {},
  ): Promise<T[]> {
    if (!this.isInitialized()) {
      throw new Error('Neo4j not available');
    }
    const session = this.getSession();
    try {
      const result = await session.run(query, params);
      return result.records.map((record) => this.recordToObject(record)) as T[];
    } catch (error: any) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async runQuerySingle<T = any>(
    query: string,
    params: Record<string, any> = {},
  ): Promise<T | null> {
    const results = await this.runQuery<T>(query, params);
    return results.length > 0 ? results[0] : null;
  }

  private recordToObject(record: Neo4jRecord): Record<string, any> {
    const obj: Record<string, any> = {};
    record.keys.forEach((key) => {
      const value = record.get(key);
      if (typeof key === 'string') {
        obj[key] = this.convertNeo4jValue(value);
      }
    });
    return obj;
  }

  private convertNeo4jValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (neo4j.isInt(value)) {
      return value.toNumber();
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.convertNeo4jValue(v));
    }

    if (typeof value === 'object' && value.properties) {
      return this.convertNeo4jValue(value.properties);
    }

    if (typeof value === 'object' && value.identity && value.labels) {
      const node: Record<string, any> = {
        id: value.identity.toNumber(),
        labels: value.labels,
      };
      Object.keys(value.properties).forEach((key) => {
        node[key] = this.convertNeo4jValue(value.properties[key]);
      });
      return node;
    }

    if (typeof value === 'object' && value.identity && value.type) {
      const rel: Record<string, any> = {
        id: value.identity.toNumber(),
        type: value.type,
      };
      Object.keys(value.properties).forEach((key) => {
        rel[key] = this.convertNeo4jValue(value.properties[key]);
      });
      return rel;
    }

    return value;
  }

  async createNode(
    label: string,
    properties: Record<string, any>,
  ): Promise<Record<string, any>> {
    const query = `
      CREATE (n:${label} $properties)
      RETURN n
    `;
    const result = await this.runQuerySingle(query, { properties });
    return result?.n || result;
  }

  async findNodeById(
    label: string,
    id: string,
  ): Promise<Record<string, any> | null> {
    const query = `
      MATCH (n:${label} {id: $id})
      RETURN n
    `;
    const result = await this.runQuerySingle(query, { id });
    return result?.n || result;
  }

  async findNodes(
    label: string,
    properties: Record<string, any> = {},
  ): Promise<Record<string, any>[]> {
    const propStr =
      Object.keys(properties).length > 0
        ? '{' +
          Object.keys(properties)
            .map((k) => `${k}: $${k}`)
            .join(', ') +
          '}'
        : '';
    const query = `
      MATCH (n:${label} ${propStr})
      RETURN n
    `;
    const results = await this.runQuery(query, properties);
    return results.map((r: any) => r.n || r);
  }

  async createRelation(
    fromLabel: string,
    fromId: string,
    relationType: string,
    toLabel: string,
    toId: string,
    properties: Record<string, any> = {},
  ): Promise<void> {
    const query = `
      MATCH (a:${fromLabel} {id: $fromId})
      MATCH (b:${toLabel} {id: $toId})
      MERGE (a)-[r:${relationType}]->(b)
      SET r += $properties
    `;
    await this.runQuery(query, { fromId, toId, properties });
  }

  async findRelatedNodes(
    label: string,
    id: string,
    relationType: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'outgoing',
  ): Promise<Record<string, any>[]> {
    let pattern: string;
    switch (direction) {
      case 'outgoing':
        pattern = `(n)-[:${relationType}]->(related)`;
        break;
      case 'incoming':
        pattern = `(n)<-[:${relationType}]-(related)`;
        break;
      case 'both':
        pattern = `(n)-[:${relationType}]-(related)`;
        break;
    }

    const query = `
      MATCH ${pattern}
      WHERE n.id = $id
      RETURN related
    `;
    const results = await this.runQuery(query, { id });
    return results.map((r: any) => r.related || r);
  }

  async findShortestPath(
    fromLabel: string,
    fromId: string,
    toLabel: string,
    toId: string,
  ): Promise<Record<string, any>[]> {
    const query = `
      MATCH (a:${fromLabel} {id: $fromId}), (b:${toLabel} {id: $toId})
      MATCH p = shortestPath((a)-[*]-(b))
      RETURN p
    `;
    const result = await this.runQuerySingle(query, { fromId, toId });
    return result?.p || [];
  }

  async clearAll(): Promise<void> {
    const query = 'MATCH (n) DETACH DELETE n';
    await this.runQuery(query);
  }
}
