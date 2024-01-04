/**
 * This provides the API endpoints for the participants profiles.
 */

import express from 'express'
import passport from 'passport'
import { DAL } from '../DAL/DAL.mjs'
import { applogger } from '../services/logger.mjs'
import auditLogger from '../services/auditLogger.mjs'
import { studyStatusUpdateCompose } from '../services/emailComposer.mjs'
import { deleteAttachmentsByUser } from '../services/attachments.mjs'

const router = express.Router()

export default async function () {

  // query parameters:
  // teamKey, studyKey, currentStatus
  router.get(
    '/participants',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      try {
        if (req.user.role === 'participant') {
          // participants can retrieve only themselves
          const result = await DAL.getParticipantByUserKey(req.user._key)
          res.send(result)
        } else if (
          req.user.role === 'researcher' ||
          req.user.role === 'admin'
        ) {
          if (req.user.role === 'researcher') {
            // extra check about the teams
            if (req.query.teamKey) {
              const team = await DAL.getOneTeam(req.query.teamKey)
              if (!team.researchersKeys.includes(req.user._key)) {
                return res.sendStatus(403)
              }
            }
            if (req.query.studyKey) {
              const team = await DAL.getAllTeams(
                req.user._key,
                req.query.studyKey
              )
              if (team.length === 0) return res.sendStatus(403)
            }
          }
          let participants = []
          if (req.query.studyKey) {
            participants = await DAL.getParticipantsByStudy(
              req.query.studyKey,
              req.query.currentStatus
            )
          } else if (req.query.teamKey) {
            participants = await DAL.getParticipantsByTeam(
              req.query.teamKey,
              req.query.currentStatus
            )
          } else if (req.query.currentStatus) {
            if (req.user.role === 'researcher') {
              participants = await DAL.getParticipantsByResearcher(req.user._key, req.query.currentStatus)
            } else {
              // admin
              participants = await DAL.getAllParticipants(req.query.currentStatus)
            }
          } else {
            if (req.user.role === 'researcher') {
              participants = await DAL.getParticipantsByResearcher(req.user._key)
            } else {
              participants = await DAL.getAllParticipants()
            }
          }
          res.json(participants)
        } else res.sendStatus(403)
      } catch (err) {
        applogger.error({ error: err }, 'Cannot retrieve participants')
        res.sendStatus(500)
      }
    }
  )

  router.get(
    '/participants/:participant_key',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      try {
        if (
          req.user.role === 'participant' &&
          req.params.participant_key !== req.user._key
        ) {
          return res.sendStatus(403)
        } else if (req.user.role === 'researcher') {
          const areLinked = await DAL.hasResearcherParticipant(req.user._key, null, req.params.participant_key)
          if (!areLinked) {
            applogger.warn('Researcher ' + req.user._key + ' trying to get details of participant with key (not user) ' + req.params.userKey + ' but has no studies with such person')
            return res.sendStatus(403)
          }
        } else {
          const participant = await DAL.getOneParticipant(
            req.params.participant_key
          )
          res.send(participant)
        }
      } catch (err) {
        applogger.error(
          { error: err },
          'Cannot retrieve participant with _key ' + req.params.participant_key
        )
        res.sendStatus(500)
      }
    }
  )

  router.post(
    '/participants',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      let newparticipant = req.body
      newparticipant.createdTS = new Date()
      try {
        if (req.user.role === 'participant') {
          newparticipant = await DAL.createParticipant(newparticipant)
          res.send(newparticipant)
          applogger.info(
            {
              userKey: newparticipant.userKey,
              participantKey: newparticipant._key
            },
            'New participant profile created'
          )
          auditLogger.log(
            'participantCreated',
            req.user._key,
            undefined,
            undefined,
            'New participant created',
            'participants',
            newparticipant._key
          )
        } else res.sendStatus(403)
      } catch (err) {
        applogger.error({ error: err }, 'Cannot store new participant')
        res.sendStatus(500)
      }
    }
  )

  // Delete a user
  router.delete(
    '/participants/byuserkey/:userKey',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      if (
        req.user.role === 'participant' &&
        req.params.userKey !== req.user._key
      ) {
        return res.sendStatus(403)
      }
      if (req.user.role === 'researcher') return res.sendStatus(403)
      try {
        const userKey = req.params.userKey
        const participant = await DAL.getParticipantByUserKey(userKey)
        if (!participant) return res.sendStatus(404)

        // Remove Answers
        await DAL.deleteAnswersByUser(userKey)

        // Remove Health Store Data
        await DAL.deleteHealthStoreDataByUser(userKey)

        // Remove Miband3 Data
        await DAL.deleteMiband3DataByUser(userKey)

        // Remove QCST Data
        await DAL.deleteQCSTDataByUser(userKey)

        // Remove SMWT Data
        await DAL.deleteSmwtByUser(userKey)

        // Remove PO60 Data
        await DAL.deletePO60DataByUser(userKey)

        // Remove Peakflow Data
        await DAL.deletePeakFlowDataByUser(userKey)

        // Remove Position Data
        await DAL.deletePositionsByUser(userKey)

        // Remove Tasks results
        await DAL.deleteTasksResultsByUser(userKey)

        // Remove attachments
        await deleteAttachmentsByUser(userKey)

        // Remove Audit logs
        await DAL.deleteLogsByUser(userKey)

        await DAL.removeParticipant(participant._key)
        await DAL.removeUser(req.params.userKey)
        res.sendStatus(200)
        applogger.info(
          { userKey: participant._key },
          'Participant profile deleted'
        )
        auditLogger.log(
          'participantDeleted',
          req.user._key,
          undefined,
          undefined,
          'Participant deleted',
          'participants',
          participant._key
        )
      } catch (err) {
        // respond to request with error
        applogger.error({ error: err }, 'Cannot delete participant')
        res.sendStatus(500)
      }
    }
  )

  // Delete Specified participant. Called from Web API by Admin.
  router.delete(
    '/participants/:participant_key',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      try {
        const partKey = req.params.participant_key
        // Get User Key of participant first. Then remove participant and then user.
        const participant = await DAL.getOneParticipant(partKey)
        if (participant === null) return res.sendStatus(404)
        // Participant can remove only himself from Participant and Users DB
        const userKey = participant.userKey
        if (req.user.role === 'researcher') return res.sendStatus(403)
        if (
          req.user.role === 'participant' &&
          req.params.userKey !== req.user._key
        ) {
          return res.sendStatus(403)
        }

        // Remove Answers
        await DAL.deleteAnswersByUser(userKey)

        // Remove Health Store Data
        await DAL.deleteHealthStoreDataByUser(userKey)

        // Remove Miband3 Data
        await DAL.deleteMiband3DataByUser(userKey)

        // Remove Peakflow Data
        await DAL.deletePeakFlowDataByUser(userKey)

        // Remove Position Data
        await DAL.deletePositionsByUser(userKey)

        // Remove Tasks results
        await DAL.deleteTasksResultsByUser(userKey)

        // Remove attachments
        await deleteAttachmentsByUser(userKey)

        // Remove Audit logs
        await DAL.deleteLogsByUser(userKey)

        await DAL.removeParticipant(partKey)
        await DAL.removeUser(userKey)
        res.sendStatus(200)
        applogger.info(
          { participantKey: partKey },
          'Participant profile deleted'
        )
        auditLogger.log(
          'participantDeleted',
          req.user._key,
          undefined,
          undefined,
          'Participant deleted',
          'participants',
          partKey
        )
      } catch (err) {
        // respond to request with error
        applogger.error({ error: err }, 'Cannot delete participant')
        res.sendStatus(500)
      }
    }
  )

  // Participant by userkey
  router.get(
    '/participants/byuserkey/:userKey',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      if (req.user.role === 'participant' &&
        req.params.userKey !== req.user._key) {
        return res.sendStatus(403)
      }
      if (req.user.role === 'researcher') {
        const areLInked = await DAL.hasResearcherParticipant(req.user._key, req.params.userKey)
        if (!areLInked) {
          applogger.warn('Researcher ' + req.user._key + ' trying to get details of participant with userkey ' + req.params.userKey + ' but has no studies with such person')
          return res.sendStatus(403)
        }
      }
      try {
        const participant = await DAL.getParticipantByUserKey(req.params.userKey)
        if (!participant) return res.sendStatus(404)
        res.send(participant)
      } catch (err) {
        applogger.error(
          { error: err },
          'Cannot retrieve participant with userKey ' + req.params.userKey
        )
        res.sendStatus(500)
      }
    }
  )

  // this is meant to be used to update the info not related to the studies
  router.patch(
    '/participants/byuserkey/:userKey',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      let newparticipant = req.body
      if (newparticipant.createdTS) delete newparticipant.createdTS
      // timestamp the update
      newparticipant.updatedTS = new Date()
      // ignore the studies property
      delete newparticipant.studies
      if (
        req.user.role === 'participant' &&
        req.params.userKey !== req.user._key
      ) {
        return res.sendStatus(403)
      }
      if (req.user.role === 'researcher') return res.sendStatus(403)
      try {
        const participant = await DAL.getParticipantByUserKey(
          req.params.userKey
        )
        if (!participant) return res.sendStatus(404)
        newparticipant = await DAL.updateParticipant(
          participant._key,
          newparticipant
        )
        res.send(newparticipant)
        applogger.info(
          { participantKey: participant._key },
          'Participant profile updated'
        )
        auditLogger.log(
          'participantUpdated',
          req.user._key,
          undefined,
          undefined,
          'Participant updated',
          'participants',
          participant._key
        )
      } catch (err) {
        applogger.error(
          { error: err },
          'Cannot update participant with _key ' + req.params.participant_key
        )
        res.sendStatus(500)
      }
    }
  )

  // this endpoint is for the app to update the status of the participant regarding a study
  // the data sent must contain the current status and the timestamp
  // withdrawalReason must be added in the case of a withdrawal
  // criteriaAnswers must be added in case of acceptance of not eligible
  // taskItemsConsent and extraItemsConsent can be added, but is not mandatory
  // example: { currentStatus: 'withdrawn', timestamp: 'ISO string', withdrawalReason: 'quit' }
  // Send Emails on change of status: active, completed, withdrawn
  router.patch(
    '/participants/byuserkey/:userKey/studies/:studyKey',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      const userKey = req.params.userKey
      const studyKey = req.params.studyKey
      const payload = req.body
      let currentStatus
      const updatedCurrentStatus = payload.currentStatus
      try {
        if (
          req.user.role === 'participant' &&
          req.params.userKey !== req.user._key
        ) {
          return res.sendStatus(403)
        }
        if (req.user.role === 'researcher') {
          const areLinked = await DAL.hasResearcherParticipant(req.user._key, req.params.userKey)
          if (!areLinked) {
            applogger.warn('Researcher ' + req.user._key + ' trying to get details of participant with userkey ' + req.params.userKey + ' but has no studies with such person')
            return res.sendStatus(403)
          }
        }
        if (!userKey || !studyKey) return res.sendStatus(400)
        const user = await DAL.getOneUser(userKey)
        if (!user) return res.sendStatus(404)
        const participant = await DAL.getParticipantByUserKey(userKey)
        if (!participant) return res.sendStatus(404)

        // Updated Time Stamp
        participant.updatedTS = new Date()

        // Create studies array if none exist, else find existing one
        let studyIndex = -1
        if (!participant.studies) {
          participant.studies = []
        } else {
          studyIndex = participant.studies.findIndex((s) => {
            return s.studyKey === studyKey
          })
        }

        // empty payload can be sent to reset a test user
        const isEmptyPayload = (Object.keys(payload).length === 0)
        if (isEmptyPayload && !user.testUser) return res.sendStatus(400)

        if (studyIndex === -1 && isEmptyPayload) {
          // nothing to do, study is not listed for this participant
          return res.sendStatus(200)
        } else if (studyIndex === -1 && !isEmptyPayload) {
          // study needs to be added
          participant.studies.push({
            studyKey: studyKey
          })
          studyIndex = participant.studies.length - 1
        }

        if (isEmptyPayload) {
          // study must be removed
          participant.studies.splice(studyIndex, 1)
        } else {
          // study must be updated

          // Get study status before patch update
          currentStatus = participant.studies[studyIndex].currentStatus

          // update the study
          // TODO: use [deepmerge](https://github.com/TehShrike/deepmerge) instead
          participant.studies[studyIndex] = payload
        }

        // Update the DB
        await DAL.updateParticipant(participant._key, participant)
        applogger.info(
          { participantKey: participant._key, study: payload },
          'Participant has changed studies status'
        )
        auditLogger.log(
          'participantStudyUpdate',
          req.user._key,
          payload.studyKey,
          undefined,
          'Participant with key ' +
          participant._key +
          ' has changed studies status',
          'participants',
          participant._key
        )
        res.sendStatus(200)

        // if there is a change in status, then send email reflecting updated status change
        // this should fail gracefully
        try {
          if (updatedCurrentStatus !== currentStatus) {
            const em = await studyStatusUpdateCompose(studyKey, participant)
            await mailSender.sendEmail(req.user.email, em.title, em.content)
          }
        } catch (err) {
          applogger.error(
            { error: err },
            'Cannot send study update email to user key ' + userKey
          )
        }
      } catch (err) {
        applogger.error(
          { error: err },
          'Cannot update participant with user key ' + userKey
        )
        res.sendStatus(500)
      }
    }
  )

  // this endpoint is for the app to update the status of the participant regarding a study and a task
  // example: { taskId: 3, consented: true, lastExecuted: "2019-02-27T12:46:07.294Z", lastMiband3SampleTS: "2019-03-05T12:46:07.294Z" }
  router.patch(
    '/participants/studies/:studyKey/taskItemsConsent/:taskId',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      const userKey = req.user._key
      const studyKey = req.params.studyKey
      const taskId = req.params.taskId
      const payload = req.body
      payload.studyKey = studyKey

      try {
        if (req.user.role != 'participant') return res.sendStatus(403)
        if (!userKey || !studyKey) return res.sendStatus(400)
        const participant = await DAL.getParticipantByUserKey(userKey)
        if (!participant) return res.sendStatus(404)

        // find the study
        let studyIndex = -1
        if (!participant.studies) return res.sendStatus(404)

        studyIndex = participant.studies.findIndex((s) => {
          return s.studyKey === studyKey
        })
        if (studyIndex === -1) return res.sendStatus(404)

        let taskIndex = -1
        taskIndex = participant.studies[studyIndex].taskItemsConsent.findIndex(
          (t) => {
            return t.taskId == taskId // TODO: taskId sent is a string, while on the server its stored as a number.
          }
        )
        if (taskIndex === -1) return res.sendStatus(404)

        // TODO: use [deepmerge](https://github.com/TehShrike/deepmerge) instead
        participant.studies[studyIndex].taskItemsConsent[taskIndex] = payload

        // Update the DB
        await DAL.updateParticipant(participant._key, participant)

        res.sendStatus(200)
        applogger.info(
          { participantKey: participant._key, taskItemConsent: payload },
          'Participant has changed task item consent status'
        )
        auditLogger.log(
          'participantStudyUpdate',
          req.user._key,
          payload.studyKey,
          undefined,
          'Participant with key ' +
          participant._key +
          ' has changed task item consent status',
          'participants',
          participant._key
        )
      } catch (err) {
        applogger.error(
          { error: err },
          'Cannot update participant with user key ' + userKey
        )
        res.sendStatus(500)
      }
    }
  )

  // gets simple statistics about the study
  router.get(
    '/participants/statusStats/:studyKey',
    passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      try {
        if (req.user.role === 'participant') {
          res.sendStatus(403)
        } else if (req.user.role === 'researcher') {
          if (req.user.role === 'researcher') {
            const team = await DAL.getAllTeams(
              req.user._key,
              req.params.studyKey
            )
            if (team.length === 0) return res.sendStatus(403)
          }
          const participants = await DAL.getParticipantsStatusCountByStudy(
            req.params.studyKey
          )
          res.json(participants)
        }
      } catch (err) {
        applogger.error({ error: err }, 'Cannot retrieve participants')
        res.sendStatus(500)
      }
    }
  )

  return router
}
