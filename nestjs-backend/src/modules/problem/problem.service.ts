import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Problem, ProblemDocument } from './schemas/problem.schema';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';

@Injectable()
export class ProblemService {
  constructor(
    @InjectModel(Problem.name) private problemModel: Model<ProblemDocument>,
  ) {}

  async create(createProblemDto: CreateProblemDto): Promise<Problem> {
    const createdProblem = new this.problemModel(createProblemDto);
    return createdProblem.save();
  }

  async findAll(): Promise<Problem[]> {
    return this.problemModel.find().exec();
  }

  async findOne(id: string): Promise<Problem | null> {
    return this.problemModel.findById(id).exec();
  }

  async update(
    id: string,
    updateProblemDto: UpdateProblemDto,
  ): Promise<Problem | null> {
    return this.problemModel
      .findByIdAndUpdate(id, updateProblemDto, { new: true })
      .exec();
  }

  async remove(id: string): Promise<Problem | null> {
    return this.problemModel.findByIdAndDelete(id).exec();
  }
}
