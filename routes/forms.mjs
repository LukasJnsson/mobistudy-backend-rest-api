'use strict'

/**
* This provides the API endpoints for the form descriptions.
*/

import express from 'express'
import getDB from '../DB/DB'
import getLoggers from '../logger'

const router = express.Router()

export default async function () {
  var db = await getDB()
  const loggers = await getLoggers()
  const logger = loggers.applogger

  router.get('/forms', async function (req, res) {
    try {
      // TODO: do some access control
      let forms = await db.getAllForms()
      res.send(forms)
    } catch (err) {
      logger.error({ error: err }, 'Cannot retrieve forms')
      res.sendStatus(500)
    }
  })

  router.get('/forms/:form_key', async function (req, res) {
    try {
      // TODO: do some access control
      let form = await db.getOneForm(req.params.form_key)
      res.send(form)
    } catch (err) {
      console.error(err)
      logger.error({ error: err }, 'Cannot retrieve form with _key ' + req.params.form_key)
      res.sendStatus(500)
    }
  })

  router.post('/forms', async function (req, res) {
    let newform = req.body
    try {
      // TODO: do some access control
      newform = await db.createForm(newform)
      res.send(newform)
    } catch (err) {
      console.error(err)
      logger.error({ error: err }, 'Cannot store new form')
      res.sendStatus(500)
    }
  })

  router.put('/forms/:form_key', async function (req, res) {
    let newform = req.body
    try {
      // TODO: do some access control
      newform = await db.updateForm(req.params.form_key, newform)
      res.send(newform)
    } catch (err) {
      console.error(err)
      logger.error({ error: err }, 'Cannot update form with _key ' + req.params.form_key)
      res.sendStatus(500)
    }
  })

  router.patch('/forms/:form_key', async function (req, res) {
    let newform = req.body
    try {
      // TODO: do some access control
      newform = await db.patchForm(req.params.form_key, newform)
      res.send(newform)
    } catch (err) {
      console.error(err)
      logger.error({ error: err }, 'Cannot patch form with _key ' + req.params.form_key)
      res.sendStatus(500)
    }
  })

  router.delete('/forms/:form_key', async function (req, res) {
    try {
      // TODO: do some access control
      await db.deleteForm(req.params.form_key)
      res.sendStatus(200)
    } catch (err) {
      console.error(err)
      logger.error({ error: err }, 'Cannot delete form with _key ' + req.params.form_key)
      res.sendStatus(500)
    }
  })

  return router
}
