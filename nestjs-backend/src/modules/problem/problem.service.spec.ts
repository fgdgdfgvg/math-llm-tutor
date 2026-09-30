import { Test, TestingModule } from '@nestjs/testing';
import { ProblemService } from './problem.service';
import { getModelToken } from '@nestjs/mongoose';
import { Problem } from './schemas/problem.schema';

describe('ProblemService', () => {
  let service: ProblemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemService,
        { provide: getModelToken(Problem.name), useValue: {} },
      ],
    }).compile();

    service = module.get<ProblemService>(ProblemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
