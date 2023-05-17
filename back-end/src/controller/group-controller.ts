import { NextFunction, Request, Response } from "express"
import { getManager, getRepository } from "typeorm"
import { Group } from "../entity/group.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"
import { CreateGroupStudentInput } from "../interface/group-student.interface"
import { GroupStudent } from "../entity/group-student.entity"

export class GroupController {
  private groupRepository = getRepository(Group)
  private studentGroupRepository = getRepository(GroupStudent)
  private entityManager = getManager()

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    // Return the list of all groups
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    // Add a Group
    const { body: params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
      student_count: params.student_count
    }
    const group = new Group()
    group.prepareToCreate(createGroupInput)
    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    // Update a Group
    const { body: params } = request

    this.groupRepository.findOne(params.id).then((group) => {
      const updateGroupInput: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt,
        student_count: params.student_count,
        run_at: params.run_at
      }
      group.prepareToUpdate(updateGroupInput)

      return this.groupRepository.save(group)
    })
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    // Delete a Group
    const groupToRemove = await this.groupRepository.findOne({ id: request.params.groupId })
    await this.groupRepository.remove(groupToRemove)
    return `Group with id ${request.params.groupId} got successfully deleted.`
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    // Return the list of Students that are in a Group
    const queryToRun = `select student.id, first_name, last_name, (first_name|| ' ' ||last_name) as full_name
    from student inner join group_student on group_student.student_id = student.id where group_id = $1`
    return await this.entityManager.query(queryToRun, [request.params.groupId])
  }


  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:
  
    // 1. Clear out the groups (delete all the students from the groups)
    await this.studentGroupRepository.clear()
    
    // 2. For each group, query the student rolls to see which students match the filter for the group
    const groups = await this.groupRepository.find()

    groups.forEach(async group => {
      const timePeriod = new Date()
      timePeriod.setDate(timePeriod.getDate() - group.number_of_weeks * 7)
      const rollState = group.roll_states
      const ltmt = group.ltmt
      let queryToRun 

      if (ltmt === '>') {
        queryToRun = `select student_id, count(*) as count from "roll" inner join "student_roll_state" SRS on SRS."roll_id" = "roll".id
        where "completed_at" > $1 and "state" = $2 group by student_id having count > $3`
      } else if (ltmt === '<') {
        queryToRun = `select student_id, count(*) as count from "roll" inner join "student_roll_state" SRS on SRS."roll_id" = "roll".id
        where "completed_at" > $1 and "state" = $2 group by student_id having count < $3`
      } else {
        throw new Error('Invalid ltmt value in group table')
      }

      const filteredStudents = await this.entityManager.query(queryToRun, [timePeriod.toISOString(), rollState, group.incidents])
      this.groupRepository.update(group.id, { run_at: timePeriod, student_count: filteredStudents.length})

      // 3. Add the list of students that match the filter to the group

      await filteredStudents.forEach(res => {
        const createStudentRollStateInput : CreateGroupStudentInput = {
          group_id: group.id,
          student_id: res.student_id,
          incident_count: res.count
        }
        const studentGroup = new GroupStudent()
        studentGroup.prepareToCreate(createStudentRollStateInput)
        this.studentGroupRepository.save(studentGroup)
      })
    })
    return 'Group filter analysis completed.'
  }
}


