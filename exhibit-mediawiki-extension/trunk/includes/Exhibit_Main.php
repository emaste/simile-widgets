<?php

/**
 * This file creates the Exhibit Extension for MediaWiki.
 * With WikiMedia's extension mechanism it is possible to define
 * new tags of the form <TAGNAME> some text </TAGNAME>
 * the function registered by the extension gets the text between the
 * tags as input and can transform it into arbitrary HTML code.
 * Note: The output is not interpreted as WikiText but directly
 * included in the HTML output. So Wiki markup is not supported.
 * To activate the extension, include it from your LocalSettings.php
 * with: include("extensions/ExhibitExtension/trunk/includes/Exhibit_Main.php");
 * http://www.mediawiki.org/wiki/Extending_wiki_markup
 * @fileoverview
 */

$wgExtensionFunctions[] = "wfExhibitSetup";
$exhibitEnabled = false;

function wfExhibitSetup() {
	global $wgParser;

	/* 
 	 * This registers the extension with the WikiText parser.
 	 * The first parameter is the name of the new tag.
 	 * The second parameter is the callback function for processing the text between the tags.
  	 */
	$wgParser->setHook( "exhibit", "Exhibit_getHTMLResult" );
}

/**
 * This function inserts Exhibit scripts into the header of the page.
 * @param $out This is the modified OutputPage.
 * @return true Always return true, in order not to stop MW's hook processing.
 */
function wfExhibitAddHTMLHeader(&$out) {
	global $wgScriptPath;
	global $exhibitEnabled;
	
	if ($exhibitEnabled) {	
		$ExhibitScript = '<script type="text/javascript" src="http://simile.mit.edu/repository/exhibit/branches/2.0/src/webapp/api/exhibit-api.js?autoCreate=false&gmapkey=ABQIAAAANowuNonWJ4d9uRGbydnrrhQtmVvwtG6TMOLiwecD59_rvdOkHxSVnf2RHe6KLnOHOyWLgmqJEUyQQg"></script><script>SimileAjax.History.enabled = false;</script>';
		$WExhibitScript = '<script type="text/javascript" src="'. $wgScriptPath . '/extensions/ExhibitExtension/scripts/Exhibit_Create.js"></script>';		
		$out->addScript($ExhibitScript);
		$out->addScript($WExhibitScript);
	}

	return true;
}

/**
 * This is the callback function for converting the input text to HTML output.
 * @param {String} $input This is the text the user enters into the wikitext input box.
 */
function Exhibit_getHTMLResult( $input, $argv ) {
	global $exhibitEnabled;
	$exhibitEnabled = true;
	if ($argv["disabled"]) {
		$exhibitEnabled = false;
	}

	// use SimpleXML parser
	$xmlstr = "<?xml version='1.0' standalone='yes'?><root>$input</root>"; 
	try {
		$xml = new SimpleXMLElement($xmlstr);
		
		// <data>
		$sourceData = array();
		$sourceColumns = array();
		$sourceHideTable = array();
		foreach ($xml->source as $source) {
			array_push($sourceData, $source);
			array_push($sourceColumns, $source['columns']);
			array_push($sourceHideTable, $source['hideTable']);
		}	
		$sourceData = implode(',', $sourceData);
		$sourceColumns = implode(';', $sourceColumns);
		$sourceHideTable = implode(',', $sourceHideTable);
		
		// <configuration>	
		$facets = array();
		foreach ($xml->facet as $facet) {
			$attributes = array();
			foreach ($facet->attributes() as $a => $b) {
				$attr = $a."='".$b."'";
			array_push( $attributes, $attr);
		}
		array_push( $facets, implode(',', $attributes));
		}
		$facets = implode(';', $facets);
		
		$views = array();
		foreach ($xml->view as $view) {
			$attributes = array();
			foreach ($view->attributes() as $a => $b) {
				$attr = $a."='".$b."'";
			array_push( $attributes, $attr);
		}
		array_push( $views, implode(';', $attributes));
		}
		$views = implode('/', $views);

		$output = <<<OUTPUT
		<script type="text/javascript">
		var sourceData = "$sourceData".split(',');
		var sourceColumns = "$sourceColumns".split(';');
		var sourceHideTable = "$sourceHideTable".split(',');
		var facets = "$facets".split(';');
		var views = "$views".split('/');
		</script>
		<div id="exhibitLocation"></div>
OUTPUT;
	} catch( Exception $e) { $output = "<p>Something is wrong with the exhibit tags, sorry.</p>"; }	
	return $output;
}

?>
