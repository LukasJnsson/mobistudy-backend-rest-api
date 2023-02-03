/**
 * This provides the API endpoints for the study statistics.
 */
import { DAO } from '../DAO/DAO.mjs'
import { applogger } from '../services/logger.mjs'

export default {
  /**
   * Initialises the controller.
   */
  async init () {
  },

  /**
   * Get a summary of the last tasks performed by participants in a study.
   * mandatory query param: studyKey to filter by study
   * @param {object} req: express request object
   * @param {object} res: express response object
   * @returns a promise
   */
  async getLastTasksSummary (req, res) {
    const studyKey = req.params.study_key
    if (!studyKey) {
      const errmess = 'Cannot request study statistics without specifying a study'
      applogger.warn(errmess)
      return res.status(400).send(errmess)
    }

    try {
      const study = await DAO.getOneStudy(req.params.study_key)
      if (!study) return res.sendStatus(404)

      if (req.user.role === 'researcher') {
        const team = await DAO.getAllTeams(req.user._key, studyKey)
        if (team.length === 0) {
          const errmess = 'Researcher cannot request study statistics for a study (s)he is not involved in'
          applogger.warn(errmess)
          return res.status(403).send(errmess)
        }
      } else if (req.user.role === 'participant') {
        const errmess = 'Participants cannot see study statistics'
        applogger.warn(errmess)
        return res.status(403).send(errmess)
      }

      const resultsData = await DAO.getLastTasksSummary(studyKey)
      res.send(resultsData)
    } catch (err) {
      console.error(err)
      applogger.error({ error: err }, 'Cannot retrieve tasks results')
      res.sendStatus(500)
    }
  }
}